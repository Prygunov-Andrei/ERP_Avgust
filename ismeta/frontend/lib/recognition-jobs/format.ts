import type { RecognitionJob } from "@/lib/api/types";

// «Модель + цена + время ненавязчиво везде» (PO 2026-04-25, +duration 2026-04-28).
// Формат: «<модель> · <стоимость> · <длительность>» мелким серым. Если ни
// модель, ни цена, ни время не доступны — возвращаем null (компоненты прячут
// блок целиком, не показывают «— · — · —»).
export interface RecognitionMetaLine {
  model: string;
  cost: string;
  duration: string;
}

export function formatRecognitionMeta(
  job: Pick<RecognitionJob, "llm_costs" | "duration_seconds">,
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
  const durationSec =
    typeof job.duration_seconds === "number" ? job.duration_seconds : null;

  if (
    !model &&
    (totalUsd === null || totalUsd === 0) &&
    (durationSec === null || durationSec === 0)
  )
    return null;

  return {
    model: model ?? "—",
    cost: totalUsd ? `$${totalUsd.toFixed(2)}` : "—",
    duration: durationSec ? formatDuration(durationSec) : "—",
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
