import type { RecognitionJob } from "@/lib/api/types";

// «Модель + цена ненавязчиво везде» (PO 2026-04-25). Формат:
// «<модель> · <стоимость>» мелким серым. Если ни модель, ни цена не
// доступны — возвращаем null (компоненты прячут блок целиком, не показывают
// «— · —»).
export interface RecognitionMetaLine {
  model: string;
  cost: string;
}

export function formatRecognitionMeta(
  job: Pick<RecognitionJob, "llm_costs">,
): RecognitionMetaLine | null {
  const llm = job.llm_costs as RecognitionJob["llm_costs"];
  const model =
    "extract" in llm && llm.extract && typeof llm.extract.model === "string"
      ? llm.extract.model
      : null;
  const totalUsd =
    "total_usd" in llm && typeof llm.total_usd === "number"
      ? llm.total_usd
      : null;

  if (!model && (totalUsd === null || totalUsd === 0)) return null;

  return {
    model: model ?? "—",
    cost: totalUsd ? `$${totalUsd.toFixed(2)}` : "—",
  };
}

// Форматирует длительность в человекочитаемый вид: "37 сек" / "2 мин 14 сек".
export function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds < 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)} сек`;
  const mm = Math.floor(seconds / 60);
  const ss = Math.round(seconds % 60);
  return ss === 0 ? `${mm} мин` : `${mm} мин ${ss} сек`;
}
