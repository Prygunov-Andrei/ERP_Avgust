import * as XLSX from "xlsx";

export type PreviewRow =
  | {
      kind: "section";
      rowIdx: number;
      name: string;
    }
  | {
      kind: "item";
      rowIdx: number;
      name: string;
      unit: string;
      quantity: string;
      equipmentPrice: string;
      materialPrice: string;
      workPrice: string;
      rowId: string | null;
      action: "create" | "update";
    }
  | {
      kind: "error";
      rowIdx: number;
      name: string;
      message: string;
    };

export interface PreviewSummary {
  create: number;
  update: number;
  sections: number;
  errors: number;
}

export interface PreviewResult {
  rows: PreviewRow[];
  summary: PreviewSummary;
}

/**
 * Парсит .xlsx на клиенте. Структура соответствует backend-импортеру:
 *   колонки: Наименование | Ед.изм. | Кол-во | Цена обор. | Цена мат. |
 *            Цена работ | [row_id]
 *   первая строка — заголовок, skip.
 *   section-строка — только имя заполнено (остальные пусты).
 *   update — заполнен row_id (7-я колонка), иначе create.
 */
export async function parseXlsxPreview(file: File): Promise<PreviewResult> {
  const buf = await readAsArrayBuffer(file);
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { rows: [], summary: emptySummary() };
  }
  const ws = wb.Sheets[sheetName]!;
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: null,
    blankrows: false,
    raw: true,
  });

  const rows: PreviewRow[] = [];
  const summary = emptySummary();

  // min_row=2 у backend — skip header row.
  for (let i = 1; i < matrix.length; i++) {
    const raw = matrix[i] ?? [];
    const rowIdx = i + 1; // 1-based excel row index, как в backend ошибках
    const name = str(raw[0]);
    const unit = str(raw[1]);
    const qty = raw[2];
    const eq = raw[3];
    const mat = raw[4];
    const work = raw[5];
    const rowId = str(raw[6]) || null;

    // Полностью пустая строка — пропускаем
    const anyData =
      name !== "" ||
      unit !== "" ||
      qty !== null ||
      eq !== null ||
      mat !== null ||
      work !== null;
    if (!anyData) continue;

    if (!name) {
      rows.push({
        kind: "error",
        rowIdx,
        name: "",
        message: "пустое наименование",
      });
      summary.errors++;
      continue;
    }

    const quantityNum = toNumber(qty);

    const numericEmpty =
      qty === null &&
      eq === null &&
      mat === null &&
      work === null &&
      !unit;

    if (numericEmpty) {
      rows.push({ kind: "section", rowIdx, name });
      summary.sections++;
      continue;
    }

    if (quantityNum !== null && quantityNum < 0) {
      rows.push({
        kind: "error",
        rowIdx,
        name,
        message: `отрицательное количество (${quantityNum})`,
      });
      summary.errors++;
      continue;
    }

    const action: "create" | "update" = rowId ? "update" : "create";
    if (action === "update") summary.update++;
    else summary.create++;

    rows.push({
      kind: "item",
      rowIdx,
      name,
      unit: unit || "шт",
      quantity: quantityNum === null ? "0" : String(quantityNum),
      equipmentPrice: numOrZero(eq),
      materialPrice: numOrZero(mat),
      workPrice: numOrZero(work),
      rowId,
      action,
    });
  }

  return { rows, summary };
}

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).replace(",", ".").trim();
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function numOrZero(v: unknown): string {
  const n = toNumber(v);
  return n === null ? "0" : String(n);
}

function emptySummary(): PreviewSummary {
  return { create: 0, update: 0, sections: 0, errors: 0 };
}

/**
 * Читает File как ArrayBuffer. Предпочитаем file.arrayBuffer() если доступен;
 * FileReader — fallback для окружений, где Blob.prototype.arrayBuffer отсутствует
 * (jsdom в тестах).
 */
function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") {
    return file.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}
