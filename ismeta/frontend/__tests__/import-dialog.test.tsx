import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ImportDialog } from "@/components/estimate/import-dialog";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
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

function makeXlsx(name = "smeta.xlsx"): File {
  return new File(["mock-xlsx"], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

describe("ImportDialog", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    toastError.mockClear();
    toastSuccess.mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("рендерит dropzone и hint формата при open=true", () => {
    render(
      wrap(
        <ImportDialog
          estimateId="e1"
          open
          onOpenChange={vi.fn()}
        />,
      ),
    );
    expect(screen.getByTestId("import-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("import-dropzone")).toBeInTheDocument();
    expect(screen.getByText(/Перетащите .xlsx файл сюда/)).toBeInTheDocument();
    expect(screen.getByText(/Наименование/)).toBeInTheDocument();
    // Кнопка «Загрузить» disabled пока файл не выбран
    expect(screen.getByTestId("import-submit")).toBeDisabled();
  });

  it("hidden file input принимает .xlsx и разблокирует «Загрузить»", () => {
    render(
      wrap(<ImportDialog estimateId="e1" open onOpenChange={vi.fn()} />),
    );
    const input = screen.getByLabelText("Выбрать .xlsx файл") as HTMLInputElement;
    expect(input.accept).toContain(".xlsx");

    fireEvent.change(input, {
      target: { files: [makeXlsx("smeta.xlsx")] },
    });

    expect(screen.getByText("smeta.xlsx")).toBeInTheDocument();
    expect(screen.getByTestId("import-submit")).not.toBeDisabled();
  });

  it("отказ на не-xlsx файл (toast.error, состояние не меняется)", () => {
    render(
      wrap(<ImportDialog estimateId="e1" open onOpenChange={vi.fn()} />),
    );
    const input = screen.getByLabelText("Выбрать .xlsx файл") as HTMLInputElement;
    const bad = new File(["x"], "smeta.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [bad] } });

    expect(toastError).toHaveBeenCalledWith("Нужен файл .xlsx");
    expect(screen.getByTestId("import-submit")).toBeDisabled();
    // drop-zone всё ещё показывает placeholder
    expect(screen.getByText(/Перетащите .xlsx файл сюда/)).toBeInTheDocument();
  });

  it("drag&drop принимает .xlsx через onDrop без native click", () => {
    render(
      wrap(<ImportDialog estimateId="e1" open onOpenChange={vi.fn()} />),
    );
    const zone = screen.getByTestId("import-dropzone");

    fireEvent.dragOver(zone);
    expect(zone).toHaveAttribute("data-dragging", "true");

    fireEvent.drop(zone, {
      dataTransfer: { files: [makeXlsx("drop.xlsx")] },
    });

    expect(zone).not.toHaveAttribute("data-dragging");
    expect(screen.getByText("drop.xlsx")).toBeInTheDocument();
  });

  it("«Загрузить» шлёт POST multipart FormData без Content-Type: application/json", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ created: 42, updated: 3, errors: [] }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    render(
      wrap(<ImportDialog estimateId="e1" open onOpenChange={vi.fn()} />),
    );

    fireEvent.change(screen.getByLabelText("Выбрать .xlsx файл"), {
      target: { files: [makeXlsx("ok.xlsx")] },
    });
    fireEvent.click(screen.getByTestId("import-submit"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toMatch(/\/estimates\/e1\/import\/excel\/$/);
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect(form.get("file")).toBeInstanceOf(File);
    expect((form.get("file") as File).name).toBe("ok.xlsx");

    const headers = init.headers as Headers;
    expect(headers.get("X-Workspace-Id")).toBeTruthy();
    // Content-Type НЕ должен быть application/json — браузер сам выставит
    // multipart/form-data с boundary.
    expect(headers.get("Content-Type")).not.toBe("application/json");
  });

  it("Результат 200 — рендерит created/updated и вызывает toast.success", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ created: 42, updated: 3, errors: [] }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    render(
      wrap(<ImportDialog estimateId="e1" open onOpenChange={vi.fn()} />),
    );
    fireEvent.change(screen.getByLabelText("Выбрать .xlsx файл"), {
      target: { files: [makeXlsx()] },
    });
    fireEvent.click(screen.getByTestId("import-submit"));

    await waitFor(() =>
      expect(screen.getByText("Результат импорта")).toBeInTheDocument(),
    );

    const created = screen.getByTestId("result-created");
    expect(within(created).getByText("42")).toBeInTheDocument();
    const updated = screen.getByTestId("result-updated");
    expect(within(updated).getByText("3")).toBeInTheDocument();
    expect(screen.queryByTestId("result-errors")).toBeNull();
    expect(toastSuccess).toHaveBeenCalledWith(
      expect.stringMatching(/\+42.*~3/),
    );
  });

  it("Частичные ошибки — рендерит список errors в ul", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          created: 10,
          updated: 1,
          errors: [
            "Строка 14: пустое наименование",
            "Строка 28: отрицательное количество (-5)",
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    render(
      wrap(<ImportDialog estimateId="e1" open onOpenChange={vi.fn()} />),
    );
    fireEvent.change(screen.getByLabelText("Выбрать .xlsx файл"), {
      target: { files: [makeXlsx()] },
    });
    fireEvent.click(screen.getByTestId("import-submit"));

    await waitFor(() =>
      expect(screen.getByTestId("result-errors")).toBeInTheDocument(),
    );

    const errors = screen.getByTestId("result-errors");
    expect(within(errors).getByText(/Ошибки: 2/)).toBeInTheDocument();
    const items = errors.querySelectorAll("li");
    expect(items).toHaveLength(2);
    expect(items[0]!.textContent).toContain("Строка 14: пустое наименование");
    expect(items[1]!.textContent).toContain("Строка 28: отрицательное");
  });

  it("400 с валидным {created:0, updated:0, errors} — показывается как result, не фейл", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          created: 0,
          updated: 0,
          errors: ["Нет активного листа"],
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    render(
      wrap(<ImportDialog estimateId="e1" open onOpenChange={vi.fn()} />),
    );
    fireEvent.change(screen.getByLabelText("Выбрать .xlsx файл"), {
      target: { files: [makeXlsx()] },
    });
    fireEvent.click(screen.getByTestId("import-submit"));

    await waitFor(() =>
      expect(screen.getByTestId("result-errors")).toBeInTheDocument(),
    );
    expect(
      within(screen.getByTestId("result-errors")).getByText(
        /Нет активного листа/,
      ),
    ).toBeInTheDocument();
    expect(toastError).not.toHaveBeenCalled();
  });
});
