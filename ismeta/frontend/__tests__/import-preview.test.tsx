import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as XLSX from "xlsx";

import { ImportDialog } from "@/components/estimate/import-dialog";
import { parseXlsxPreview } from "@/lib/excel/preview";

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

/**
 * Создаёт настоящий .xlsx blob в памяти через SheetJS и оборачивает в File,
 * чтобы ImportDialog смог его распарсить на клиенте.
 */
function makeXlsxFile(
  rows: (string | number | null)[][],
  filename = "smeta.xlsx",
): File {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new File([buf], filename, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

const HEADER = [
  "Наименование",
  "Ед.изм.",
  "Кол-во",
  "Цена обор.",
  "Цена мат.",
  "Цена работ",
  "row_id",
];

describe("parseXlsxPreview — xlsx parser", () => {
  it("классифицирует строки: section (только имя), create (без row_id), update (с row_id), error (пустое имя)", async () => {
    const file = makeXlsxFile([
      HEADER,
      ["Вентиляция", null, null, null, null, null, null],
      ["Воздуховод 500x400", "м.п.", 42.5, 0, 1200, 180, null],
      ["Вентилятор MOB", "шт", 4, 50000, 0, 12000, "rid-existing"],
      [null, "шт", 1, 0, 0, 0, null],
    ]);
    const result = await parseXlsxPreview(file);
    expect(result.summary).toEqual({
      create: 1,
      update: 1,
      sections: 1,
      errors: 1,
    });
    const kinds = result.rows.map((r) => r.kind);
    expect(kinds).toEqual(["section", "item", "item", "error"]);

    const create = result.rows.find(
      (r) => r.kind === "item" && r.action === "create",
    );
    expect(create && create.kind === "item" && create.rowId).toBeNull();

    const update = result.rows.find(
      (r) => r.kind === "item" && r.action === "update",
    );
    expect(update && update.kind === "item" && update.rowId).toBe(
      "rid-existing",
    );
  });

  it("ошибки: отрицательное количество", async () => {
    const file = makeXlsxFile([
      HEADER,
      ["Кабель UTP", "м", -5, 0, 150, 0, null],
    ]);
    const result = await parseXlsxPreview(file);
    expect(result.summary.errors).toBe(1);
    const err = result.rows[0]!;
    expect(err.kind).toBe("error");
    if (err.kind === "error") {
      expect(err.message).toMatch(/отрицательное/);
    }
  });
});

describe("ImportDialog — preview flow", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    toastError.mockClear();
    toastSuccess.mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("загрузка файла → стадия preview, таблица с green/yellow/section-строками", async () => {
    const file = makeXlsxFile([
      HEADER,
      ["Вентиляция", null, null, null, null, null, null],
      ["Воздуховод", "м.п.", 10, 0, 500, 100, null],
      ["Вентилятор MOB", "шт", 2, 50000, 0, 12000, "rid-1"],
    ]);

    render(
      wrap(
        <ImportDialog estimateId="e1" open onOpenChange={vi.fn()} />,
      ),
    );
    fireEvent.change(screen.getByLabelText("Выбрать .xlsx файл"), {
      target: { files: [file] },
    });

    await waitFor(() =>
      expect(screen.getByTestId("import-dialog")).toHaveAttribute(
        "data-stage",
        "preview",
      ),
    );

    // Summary-badges
    expect(screen.getByTestId("summary-create").textContent).toContain(
      "Создать: 1",
    );
    expect(screen.getByTestId("summary-update").textContent).toContain(
      "Обновить: 1",
    );
    expect(screen.getByTestId("summary-sections").textContent).toContain(
      "Разделов: 1",
    );

    // Таблица с 3 строками (1 section + 2 items)
    const sectionRows = document.querySelectorAll(
      'tr[data-row-kind="section"]',
    );
    expect(sectionRows).toHaveLength(1);
    const createRows = document.querySelectorAll(
      'tr[data-row-kind="item"][data-action="create"]',
    );
    expect(createRows).toHaveLength(1);
    const updateRows = document.querySelectorAll(
      'tr[data-row-kind="item"][data-action="update"]',
    );
    expect(updateRows).toHaveLength(1);

    // Apply-кнопка показывает общее число (create+update)
    expect(
      within(screen.getByTestId("preview-apply")).getByText(/\(2\)/),
    ).toBeInTheDocument();

    // fetch НЕ вызывался — apply ещё не нажали
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("«Сменить файл» возвращает на стадию choose и очищает preview", async () => {
    const file = makeXlsxFile([
      HEADER,
      ["Воздуховод", "м.п.", 10, 0, 500, 100, null],
    ]);

    render(
      wrap(<ImportDialog estimateId="e1" open onOpenChange={vi.fn()} />),
    );
    fireEvent.change(screen.getByLabelText("Выбрать .xlsx файл"), {
      target: { files: [file] },
    });

    await waitFor(() =>
      expect(screen.getByTestId("import-dialog")).toHaveAttribute(
        "data-stage",
        "preview",
      ),
    );

    fireEvent.click(screen.getByTestId("preview-cancel"));

    expect(screen.getByTestId("import-dialog")).toHaveAttribute(
      "data-stage",
      "choose",
    );
    // Dropzone виден снова
    expect(screen.getByTestId("import-dropzone")).toBeInTheDocument();
    // Preview summary исчез
    expect(screen.queryByTestId("preview-summary")).toBeNull();
  });

  it("«Применить» шлёт POST FormData только после подтверждения preview", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ created: 1, updated: 0, errors: [] }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const file = makeXlsxFile([
      HEADER,
      ["Воздуховод", "м.п.", 10, 0, 500, 100, null],
    ]);

    render(
      wrap(<ImportDialog estimateId="e1" open onOpenChange={vi.fn()} />),
    );
    fireEvent.change(screen.getByLabelText("Выбрать .xlsx файл"), {
      target: { files: [file] },
    });
    await waitFor(() =>
      expect(screen.getByTestId("preview-apply")).toBeInTheDocument(),
    );
    // До apply — fetch не вызывался
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("preview-apply"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toMatch(/\/estimates\/e1\/import\/excel\/$/);
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);

    // После успеха — стадия result
    await waitFor(() =>
      expect(screen.getByTestId("import-dialog")).toHaveAttribute(
        "data-stage",
        "result",
      ),
    );
    expect(screen.getByTestId("result-created").textContent).toContain("1");
  });

  it("файл только с ошибками → «Применить» disabled (нечего применять)", async () => {
    const file = makeXlsxFile([
      HEADER,
      [null, "шт", 1, 0, 0, 0, null], // пустое наименование — error
    ]);
    render(
      wrap(<ImportDialog estimateId="e1" open onOpenChange={vi.fn()} />),
    );
    fireEvent.change(screen.getByLabelText("Выбрать .xlsx файл"), {
      target: { files: [file] },
    });

    await waitFor(() =>
      expect(screen.getByTestId("summary-errors")).toBeInTheDocument(),
    );

    expect(screen.getByTestId("preview-apply")).toBeDisabled();
  });

  it("не-xlsx файл — остаёмся на choose, toast.error", () => {
    render(
      wrap(<ImportDialog estimateId="e1" open onOpenChange={vi.fn()} />),
    );
    fireEvent.change(screen.getByLabelText("Выбрать .xlsx файл"), {
      target: {
        files: [new File(["x"], "doc.pdf", { type: "application/pdf" })],
      },
    });
    expect(toastError).toHaveBeenCalledWith("Нужен файл .xlsx");
    expect(screen.getByTestId("import-dialog")).toHaveAttribute(
      "data-stage",
      "choose",
    );
  });
});
