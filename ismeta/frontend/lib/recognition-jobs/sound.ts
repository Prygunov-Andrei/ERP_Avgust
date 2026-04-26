// Звуковой сигнал при завершении распознавания.
// Toggle живёт в localStorage (на MVP без backend persistence). Default — OFF.

const STORAGE_KEY = "ismeta:recognition-sound";

export function getSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  if (enabled) window.localStorage.setItem(STORAGE_KEY, "1");
  else window.localStorage.removeItem(STORAGE_KEY);
  // Уведомляем подписчиков (например, settings toggle) о смене.
  window.dispatchEvent(new CustomEvent("ismeta:sound-changed"));
}

export function playDingIfEnabled(): void {
  if (!getSoundEnabled()) return;
  if (typeof window === "undefined") return;
  try {
    const audio = new Audio("/sounds/ding.mp3");
    audio.volume = 0.5;
    void audio.play().catch(() => {
      // browser autoplay policy may block — ignore silently
    });
  } catch {
    // ignore — Audio constructor may not be available in jsdom
  }
}
