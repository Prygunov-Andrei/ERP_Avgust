"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export interface ResizableSidebarProps {
  children: React.ReactNode;
  /**
   * Ключ localStorage, например "ismeta.sidebar.sections.width".
   */
  storageKey: string;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  /**
   * Какая сторона имеет handle. "right" = handle справа (типичный
   * левый sidebar). "left" = handle слева (для правой панели).
   */
  side?: "left" | "right";
  className?: string;
  /**
   * Текст для screen reader и title. По умолчанию «Изменить ширину панели».
   */
  handleLabel?: string;
}

/**
 * Vertical drag-handle + keyboard resize + localStorage persistence.
 *
 * - SSR-safe: начальный рендер с defaultWidth, значение из LS применяется
 *   в useEffect после mount.
 * - Клавиатура: Tab → focus handle, ←/→ ±10px, Shift+стрелка ±50px,
 *   Home/End → min/max.
 * - LS пишется только на mouseup/touchend/keyup (не на каждый move).
 */
export function ResizableSidebar({
  children,
  storageKey,
  defaultWidth = 256,
  minWidth = 200,
  maxWidth = 600,
  side = "right",
  className,
  handleLabel = "Изменить ширину панели",
}: ResizableSidebarProps) {
  const clamp = React.useCallback(
    (value: number) => Math.max(minWidth, Math.min(maxWidth, value)),
    [minWidth, maxWidth],
  );

  const [width, setWidth] = React.useState<number>(defaultWidth);
  const dragStateRef = React.useRef<{
    startX: number;
    startWidth: number;
  } | null>(null);

  // Load from localStorage после mount (SSR-safe).
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw === null) return;
      const n = Number.parseInt(raw, 10);
      if (Number.isFinite(n)) {
        setWidth(clamp(n));
      }
    } catch {
      // localStorage may be unavailable (private mode); ignore.
    }
  }, [storageKey, clamp]);

  const persist = React.useCallback(
    (value: number) => {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(storageKey, String(value));
      } catch {
        // ignore
      }
    },
    [storageKey],
  );

  // ----- Mouse drag -----
  const onPointerMove = React.useCallback(
    (e: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state) return;
      const dx = e.clientX - state.startX;
      const next = clamp(
        side === "right" ? state.startWidth + dx : state.startWidth - dx,
      );
      setWidth(next);
    },
    [clamp, side],
  );

  const onPointerUp = React.useCallback(() => {
    if (!dragStateRef.current) return;
    dragStateRef.current = null;
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    setWidth((w) => {
      persist(w);
      return w;
    });
  }, [onPointerMove, persist]);

  const onPointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Только левая кнопка мыши / touch.
      if (e.button !== 0 && e.pointerType === "mouse") return;
      e.preventDefault();
      dragStateRef.current = {
        startX: e.clientX,
        startWidth: width,
      };
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    },
    [onPointerMove, onPointerUp, width],
  );

  // Cleanup на unmount — если размонтировали прямо во время drag.
  React.useEffect(() => {
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [onPointerMove, onPointerUp]);

  // ----- Keyboard -----
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 50 : 10;
    let handled = true;
    const dir = side === "right" ? 1 : -1;
    if (e.key === "ArrowLeft") {
      setWidth((w) => clamp(w - step * dir));
    } else if (e.key === "ArrowRight") {
      setWidth((w) => clamp(w + step * dir));
    } else if (e.key === "Home") {
      setWidth(minWidth);
    } else if (e.key === "End") {
      setWidth(maxWidth);
    } else {
      handled = false;
    }
    if (handled) {
      e.preventDefault();
    }
  };

  const onKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      e.key === "ArrowLeft" ||
      e.key === "ArrowRight" ||
      e.key === "Home" ||
      e.key === "End"
    ) {
      persist(width);
    }
  };

  const handle = (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={handleLabel}
      aria-valuenow={width}
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      tabIndex={0}
      data-testid="resizable-sidebar-handle"
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      title={handleLabel}
      className={cn(
        "absolute top-0 z-10 h-full w-1 cursor-col-resize bg-transparent transition-colors",
        "hover:bg-primary/40 focus:bg-primary/40 focus:outline-none",
        side === "right" ? "right-0" : "left-0",
      )}
    />
  );

  return (
    <aside
      data-testid="resizable-sidebar"
      style={{ width, maxWidth: "calc(100vw - 200px)" }}
      className={cn(
        "relative flex shrink-0 flex-col",
        className,
      )}
    >
      {children}
      {handle}
    </aside>
  );
}
