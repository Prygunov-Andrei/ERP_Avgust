import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { RecognitionJobsIndicator } from "@/components/layout/recognition-jobs-indicator";
import { RecognitionJobsProvider } from "@/contexts/recognition-jobs-context";
import type { RecognitionJob, RecognitionJobStatus } from "@/lib/api/types";

const toastMock = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: toastMock.toast,
  Toaster: () => null,
}));

const routerPushMock = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPushMock }),
}));

function makeJob(overrides: Partial<RecognitionJob> = {}): RecognitionJob {
  const id = overrides.id ?? "j-1";
  return {
    id,
    estimate_id: overrides.estimate_id ?? "e-1",
    estimate_name: overrides.estimate_name ?? "Объект A",
    file_name: overrides.file_name ?? "spec.pdf",
    file_type: "pdf",
    profile_id: null,
    status: overrides.status ?? "running",
    pages_total: overrides.pages_total ?? 9,
    pages_done: overrides.pages_done ?? 3,
    items_count: overrides.items_count ?? 24,
    pages_summary: [],
    llm_costs: overrides.llm_costs ?? {},
    error_message: overrides.error_message ?? "",
    apply_result: {},
    is_active:
      overrides.is_active ??
      (overrides.status === "running" || overrides.status === "queued"),
    duration_seconds: overrides.duration_seconds ?? null,
    created_at: new Date().toISOString(),
    started_at:
      overrides.started_at ??
      (overrides.status === "running" ? new Date().toISOString() : null),
    completed_at:
      overrides.completed_at ??
      (overrides.status === "done" ||
      overrides.status === "failed" ||
      overrides.status === "cancelled"
        ? new Date().toISOString()
        : null),
  };
}

function makeFetchSpy(
  initialActive: RecognitionJob[],
  initialRecent: RecognitionJob[],
) {
  let active = [...initialActive];
  let recent = [...initialRecent];

  const spy = vi.fn(async (url: string) => {
    const u = String(url);
    if (u.includes("/recognition-jobs/")) {
      const isActive = u.includes("status=queued%2Crunning");
      const isRecent = u.includes("status=done%2Cfailed%2Ccancelled");
      const data = isActive ? active : isRecent ? recent : [];
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("[]", { status: 200 });
  });

  return {
    spy,
    setActive: (next: RecognitionJob[]) => {
      active = next;
    },
    setRecent: (next: RecognitionJob[]) => {
      recent = next;
    },
  };
}

function renderIndicator(
  initialActive: RecognitionJob[],
  initialRecent: RecognitionJob[] = [],
) {
  const fetchControl = makeFetchSpy(initialActive, initialRecent);
  vi.stubGlobal("fetch", fetchControl.spy);

  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  const utils = render(
    <QueryClientProvider client={qc}>
      <RecognitionJobsProvider>
        <RecognitionJobsIndicator />
      </RecognitionJobsProvider>
    </QueryClientProvider>,
  );
  return { ...utils, ...fetchControl, qc };
}

describe("RecognitionJobsIndicator", () => {
  beforeEach(() => {
    toastMock.toast.success.mockClear();
    toastMock.toast.error.mockClear();
    routerPushMock.mockClear();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows badge with active count", async () => {
    renderIndicator([makeJob({ id: "a" }), makeJob({ id: "b" })]);

    await waitFor(() => {
      const badge = screen.getByTestId("recognition-jobs-badge");
      expect(badge).toHaveTextContent("2");
    });
  });

  it("renders empty state when no jobs", async () => {
    renderIndicator([], []);
    // Без jobs бейджа нет, иконка готовности
    expect(screen.queryByTestId("recognition-jobs-badge")).toBeNull();
  });

  it("opens popover and shows active job with progress + cancel", async () => {
    renderIndicator([
      makeJob({
        id: "a",
        estimate_name: "Объект A",
        file_name: "ОВ-2.pdf",
        pages_done: 4,
        pages_total: 9,
      }),
    ]);

    await waitFor(() => screen.getByTestId("recognition-jobs-badge"));
    fireEvent.click(screen.getByTestId("recognition-jobs-trigger"));

    const popover = await screen.findByTestId("recognition-jobs-popover");
    expect(within(popover).getByText("Объект A")).toBeInTheDocument();
    expect(within(popover).getByText("ОВ-2.pdf")).toBeInTheDocument();
    expect(within(popover).getByText(/4 из 9/)).toBeInTheDocument();
    expect(within(popover).getByText(/Открыть/)).toBeInTheDocument();
    expect(within(popover).getByTestId("recognition-job-cancel")).toBeInTheDocument();
  });

  it("cancel posts to /cancel after confirm", async () => {
    const { spy } = renderIndicator([
      makeJob({ id: "a", estimate_name: "X" }),
    ]);

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    await waitFor(() => screen.getByTestId("recognition-jobs-badge"));
    fireEvent.click(screen.getByTestId("recognition-jobs-trigger"));

    const popover = await screen.findByTestId("recognition-jobs-popover");
    fireEvent.click(within(popover).getByTestId("recognition-job-cancel"));

    await waitFor(() => {
      const cancelCall = spy.mock.calls.find((c) =>
        String(c[0]).includes("/recognition-jobs/a/cancel/"),
      );
      expect(cancelCall).toBeDefined();
    });
    expect(confirmSpy).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("fires toast when running → done transition is observed via polling", async () => {
    vi.useFakeTimers();
    try {
      const job = makeJob({
        id: "x",
        estimate_name: "Объект A",
        status: "running" as RecognitionJobStatus,
      });
      const control = makeFetchSpy([job], []);
      vi.stubGlobal("fetch", control.spy);

      const qc = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: 0 } },
      });
      render(
        <QueryClientProvider client={qc}>
          <RecognitionJobsProvider>
            <RecognitionJobsIndicator />
          </RecognitionJobsProvider>
        </QueryClientProvider>,
      );

      // Сначала seed: дождёмся первой загрузки → prevStatuses содержит running.
      await vi.runOnlyPendingTimersAsync();
      await vi.runOnlyPendingTimersAsync();

      // Меняем backend ответ: job переходит в done.
      control.setActive([]);
      control.setRecent([
        {
          ...job,
          status: "done",
          items_count: 199,
          completed_at: new Date().toISOString(),
          duration_seconds: 240,
          is_active: false,
          llm_costs: { total_usd: 0.12, extract: { model: "deepseek-v4-pro" } },
        },
      ]);

      // refetchInterval=5s для active, 10s для recent. Прокрутим достаточно.
      await vi.advanceTimersByTimeAsync(11_000);
      await vi.runOnlyPendingTimersAsync();

      expect(toastMock.toast.success).toHaveBeenCalled();
      const args = toastMock.toast.success.mock.calls[0];
      expect(args[0]).toMatch(/Объект A/);
    } finally {
      vi.useRealTimers();
    }
  });
});
