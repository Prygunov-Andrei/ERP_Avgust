import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { PdfImportDialog } from "@/components/estimate/pdf-import-dialog";
import { EmptyEstimatesState } from "@/app/estimates/empty-state";
import type { PdfImportPreview } from "@/lib/api/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (m: string) => toastError(m),
    success: (m: string) => toastSuccess(m),
    info: vi.fn(),
  },
  Toaster: () => null,
}));

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

function makePdf(name = "spec.pdf"): File {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], name, {
    type: "application/pdf",
  });
}

function makePreview(overrides: Partial<PdfImportPreview> = {}): PdfImportPreview {
  return {
    session_id: "s1",
    document_meta: {
      filenames: ["spec.pdf"],
      pages_total: 12,
      pages_processed: 12,
      confidence: 0.87,
      processing_time_ms: 18420,
      tokens_total: 52341,
      cost_usd: 0.142,
    },
    items: [
      {
        raw_name: "Вентилятор крышный MOB2600/45-3a",
        model_name: "MOB2600/45-3a",
        brand: "MOB",
        quantity: 4,
        unit: "шт",
        section_name: "ВЕНТИЛЯЦИЯ",
        tech_specs: { flow: "2600 м³/ч" },
        confidence: 0.91,
        source_page: 7,
      },
      {
        raw_name: "Воздуховод прямоугольный 500x400",
        model_name: null,
        brand: null,
        quantity: 42.5,
        unit: "м.п.",
        section_name: "ВЕНТИЛЯЦИЯ",
        tech_specs: {},
        confidence: 0.6,
        source_page: 8,
      },
    ],
    errors: [],
    ...overrides,
  };
}

describe("PdfImportDialog", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    toastError.mockClear();
    toastSuccess.mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("рендерит dropzone на стадии choose; не-pdf → toast.error", () => {
    render(
      wrap(<PdfImportDialog estimateId="e1" open onOpenChange={vi.fn()} />),
    );
    const dialog = screen.getByTestId("pdf-import-dialog");
    expect(dialog).toHaveAttribute("data-stage", "choose");
    expect(screen.getByTestId("pdf-import-dropzone")).toBeInTheDocument();

    const input = screen.getByLabelText("Выбрать .pdf файл") as HTMLInputElement;
    expect(input.accept).toContain(".pdf");

    fireEvent.change(input, {
      target: {
        files: [new File(["x"], "doc.xlsx", { type: "application/x-zip" })],
      },
    });
    expect(toastError).toHaveBeenCalledWith("Нужен файл .pdf");
    expect(dialog).toHaveAttribute("data-stage", "choose");
  });

  it("upload: POST FormData на /import/pdf/ → stage=uploading → preview", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(makePreview()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(
      wrap(<PdfImportDialog estimateId="e1" open onOpenChange={vi.fn()} />),
    );
    fireEvent.change(screen.getByLabelText("Выбрать .pdf файл"), {
      target: { files: [makePdf()] },
    });

    await waitFor(() =>
      expect(screen.getByTestId("pdf-import-dialog")).toHaveAttribute(
        "data-stage",
        "preview",
      ),
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toMatch(/\/estimates\/e1\/import\/pdf\/$/);
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    const headers = init.headers as Headers;
    expect(headers.get("X-Workspace-Id")).toBeTruthy();
    expect(headers.get("Content-Type")).not.toBe("application/json");

    // Preview meta: 12 из 12, 87%
    const meta = screen.getByTestId("pdf-meta");
    expect(within(meta).getByTestId("pdf-pages").textContent).toMatch(
      /12 из 12/,
    );
    expect(meta.textContent).toMatch(/87%/);

    // Строки распознаны
    expect(screen.getByText("MOB2600/45-3a")).toBeInTheDocument();
    expect(
      screen.getByText("Воздуховод прямоугольный 500x400"),
    ).toBeInTheDocument();

    // Confidence buckets
    const rows = document.querySelectorAll('tr[data-row-kind="pdf-item"]');
    expect(rows[0]!.getAttribute("data-confidence-bucket")).toBe("high");
    expect(rows[1]!.getAttribute("data-confidence-bucket")).toBe("medium");
  });

  it("«Применить» шлёт POST /import/pdf/apply/ с body {items}, переходит в result", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.endsWith("/import/pdf/")) {
        return new Response(JSON.stringify(makePreview()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (u.endsWith("/import/pdf/apply/")) {
        return new Response(
          JSON.stringify({ created: 2, updated: 0, errors: [] }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
      return new Response("{}", { status: 200 });
    });

    render(
      wrap(<PdfImportDialog estimateId="e1" open onOpenChange={vi.fn()} />),
    );
    fireEvent.change(screen.getByLabelText("Выбрать .pdf файл"), {
      target: { files: [makePdf()] },
    });

    await waitFor(() =>
      expect(screen.getByTestId("pdf-preview-apply")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId("pdf-preview-apply"));

    await waitFor(() =>
      expect(screen.getByTestId("pdf-import-dialog")).toHaveAttribute(
        "data-stage",
        "result",
      ),
    );

    // Body второго запроса — {items: [...]}
    const applyCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).endsWith("/import/pdf/apply/"),
    )!;
    const init = applyCall[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toHaveProperty("items");
    expect(
      JSON.parse(init.body as string).items,
    ).toHaveLength(2);

    // Result rendered
    expect(
      within(screen.getByTestId("result-created")).getByText("2"),
    ).toBeInTheDocument();
    expect(toastSuccess).toHaveBeenCalledWith(
      expect.stringMatching(/Добавлено из PDF: 2/),
    );
  });

  it("«Сменить файл» возвращает на choose и очищает preview", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(makePreview()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(
      wrap(<PdfImportDialog estimateId="e1" open onOpenChange={vi.fn()} />),
    );
    fireEvent.change(screen.getByLabelText("Выбрать .pdf файл"), {
      target: { files: [makePdf()] },
    });
    await waitFor(() =>
      expect(screen.getByTestId("pdf-import-dialog")).toHaveAttribute(
        "data-stage",
        "preview",
      ),
    );

    fireEvent.click(screen.getByTestId("pdf-preview-cancel"));
    expect(screen.getByTestId("pdf-import-dialog")).toHaveAttribute(
      "data-stage",
      "choose",
    );
    expect(screen.queryByTestId("pdf-meta")).toBeNull();
  });

  it("частичное распознавание (pages_processed < pages_total) показывает warning", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify(
          makePreview({
            document_meta: {
              filenames: ["spec.pdf"],
              pages_total: 24,
              pages_processed: 12,
              confidence: 0.7,
              processing_time_ms: 20000,
              tokens_total: 10000,
              cost_usd: 0.05,
            },
          }),
        ),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    render(
      wrap(<PdfImportDialog estimateId="e1" open onOpenChange={vi.fn()} />),
    );
    fireEvent.change(screen.getByLabelText("Выбрать .pdf файл"), {
      target: { files: [makePdf()] },
    });

    await waitFor(() => {
      const alerts = document.querySelectorAll('[role="alert"]');
      expect(alerts.length).toBeGreaterThan(0);
    });
    expect(screen.getByTestId("pdf-pages").textContent).toMatch(/12 из 24/);
  });
});

describe("EmptyEstimatesState — PDF кнопка", () => {
  it("рендерит 3 кнопки: «Новая смета», «Загрузить Excel», «Загрузить PDF»", () => {
    render(wrap(<EmptyEstimatesState />));
    expect(
      screen.getByRole("button", { name: /Новая смета/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Загрузить Excel/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Загрузить PDF/ }),
    ).toBeInTheDocument();
  });

  it("«Загрузить PDF» открывает import-new-pdf-dialog с dropzone", () => {
    render(wrap(<EmptyEstimatesState />));
    fireEvent.click(screen.getByTestId("import-new-pdf-trigger"));
    expect(screen.getByTestId("import-new-pdf-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("import-new-pdf-dropzone")).toBeInTheDocument();
  });
});
