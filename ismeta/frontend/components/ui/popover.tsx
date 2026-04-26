"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

// Лёгкий controlled-popover. Без @radix-ui/react-popover (не установлен в
// проекте), но с тем же API: Popover/PopoverTrigger/PopoverContent. Click
// outside и Escape закрывают; фокус trap не реализован, но для индикатора
// jobs это не нужно (внутри только нативные кнопки).

interface PopoverContextValue {
  open: boolean;
  setOpen: (next: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const PopoverContext = React.createContext<PopoverContextValue | null>(null);

function usePopover(): PopoverContextValue {
  const ctx = React.useContext(PopoverContext);
  if (!ctx) throw new Error("Popover.* must be inside <Popover>");
  return ctx;
}

interface PopoverProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function Popover({
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
  children,
}: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  return (
    <PopoverContext.Provider value={{ open, setOpen, triggerRef }}>
      {children}
    </PopoverContext.Provider>
  );
}

interface PopoverTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export const PopoverTrigger = React.forwardRef<
  HTMLButtonElement,
  PopoverTriggerProps
>(({ asChild, onClick, children, ...props }, forwardedRef) => {
  const { open, setOpen, triggerRef } = usePopover();
  const ref = useMergedRef(triggerRef, forwardedRef);

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{
      ref?: React.Ref<HTMLButtonElement>;
      onClick?: React.MouseEventHandler<HTMLButtonElement>;
      "aria-expanded"?: boolean;
    }>;
    return React.cloneElement(child, {
      ref,
      onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
        child.props.onClick?.(event);
        if (!event.defaultPrevented) setOpen(!open);
      },
      "aria-expanded": open,
    });
  }

  return (
    <button
      ref={ref}
      type="button"
      aria-expanded={open}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOpen(!open);
      }}
      {...props}
    >
      {children}
    </button>
  );
});
PopoverTrigger.displayName = "PopoverTrigger";

interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "center" | "end";
  sideOffset?: number;
}

export const PopoverContent = React.forwardRef<
  HTMLDivElement,
  PopoverContentProps
>(
  (
    { className, align = "end", sideOffset = 8, children, style, ...props },
    forwardedRef,
  ) => {
    const { open, setOpen, triggerRef } = usePopover();
    const localRef = React.useRef<HTMLDivElement | null>(null);
    const ref = useMergedRef(localRef, forwardedRef);
    const [position, setPosition] = React.useState<{
      top: number;
      left: number;
    } | null>(null);
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => setMounted(true), []);

    React.useLayoutEffect(() => {
      if (!open) return;
      const trigger = triggerRef.current;
      const content = localRef.current;
      if (!trigger) return;

      const updatePosition = () => {
        const rect = trigger.getBoundingClientRect();
        const contentWidth = content?.offsetWidth ?? 0;
        let left = rect.left;
        if (align === "end") left = rect.right - contentWidth;
        else if (align === "center")
          left = rect.left + rect.width / 2 - contentWidth / 2;

        // Keep inside viewport
        const padding = 8;
        left = Math.max(
          padding,
          Math.min(left, window.innerWidth - contentWidth - padding),
        );

        setPosition({ top: rect.bottom + sideOffset, left });
      };

      updatePosition();
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
      return () => {
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition, true);
      };
    }, [open, align, sideOffset, triggerRef]);

    React.useEffect(() => {
      if (!open) return;
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false);
      };
      const onPointerDown = (e: MouseEvent) => {
        const target = e.target as Node | null;
        if (
          localRef.current?.contains(target) ||
          triggerRef.current?.contains(target)
        ) {
          return;
        }
        setOpen(false);
      };
      document.addEventListener("keydown", onKey);
      document.addEventListener("mousedown", onPointerDown);
      return () => {
        document.removeEventListener("keydown", onKey);
        document.removeEventListener("mousedown", onPointerDown);
      };
    }, [open, setOpen, triggerRef]);

    if (!mounted || !open) return null;

    return createPortal(
      <div
        ref={ref}
        role="dialog"
        className={cn(
          "z-50 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none",
          "animate-in fade-in-0 zoom-in-95",
          className,
        )}
        style={{
          position: "fixed",
          top: position?.top ?? -9999,
          left: position?.left ?? -9999,
          ...style,
        }}
        {...props}
      >
        {children}
      </div>,
      document.body,
    );
  },
);
PopoverContent.displayName = "PopoverContent";

function useMergedRef<T>(
  ...refs: Array<React.Ref<T> | null | undefined>
): React.RefCallback<T> {
  return React.useCallback((value: T | null) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") ref(value);
      else (ref as React.MutableRefObject<T | null>).current = value;
    }
  }, refs); // eslint-disable-line react-hooks/exhaustive-deps
}
