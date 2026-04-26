"use client";

import * as React from "react";
import { Volume2, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  getSoundEnabled,
  setSoundEnabled,
} from "@/lib/recognition-jobs/sound";

// Минимальный «settings» для MVP: тогл звука рядом с темой.
// Полноценная Settings page (модели LLM, профиль) — это E18-3.
export function SoundToggle() {
  const [enabled, setEnabled] = React.useState(false);

  React.useEffect(() => {
    setEnabled(getSoundEnabled());
    const handler = () => setEnabled(getSoundEnabled());
    window.addEventListener("ismeta:sound-changed", handler);
    return () => window.removeEventListener("ismeta:sound-changed", handler);
  }, []);

  const toggle = () => {
    const next = !enabled;
    setSoundEnabled(next);
    setEnabled(next);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={
        enabled
          ? "Выключить звук завершения распознавания"
          : "Включить звук завершения распознавания"
      }
      title={
        enabled
          ? "Звук при завершении распознавания включён"
          : "Звук при завершении распознавания выключен"
      }
      data-testid="recognition-sound-toggle"
      data-enabled={enabled ? "true" : "false"}
    >
      {enabled ? (
        <Volume2 className="h-4 w-4 text-primary" />
      ) : (
        <VolumeX className="h-4 w-4 text-muted-foreground" />
      )}
    </Button>
  );
}
