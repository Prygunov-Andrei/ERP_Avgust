"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { recognitionJobsApi } from "@/lib/api/client";
import { getWorkspaceId } from "@/lib/workspace";
import type {
  RecognitionJob,
  RecognitionJobStatus,
} from "@/lib/api/types";

import { playDingIfEnabled } from "@/lib/recognition-jobs/sound";
import { showRecognitionToast } from "@/lib/recognition-jobs/toast";

const ACTIVE_STATUSES = "queued,running";
const TERMINAL_STATUSES = "done,failed,cancelled";
const POLL_ACTIVE_MS = 5_000;
const POLL_RECENT_MS = 10_000;

const READ_STORAGE_KEY = "ismeta:recognition-jobs:read";

function loadReadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(READ_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (Array.isArray(arr)) {
      return new Set(arr.filter((x): x is string => typeof x === "string"));
    }
    return new Set();
  } catch {
    return new Set();
  }
}

function persistReadIds(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      READ_STORAGE_KEY,
      JSON.stringify(Array.from(ids)),
    );
  } catch {
    // ignore (quota / private mode)
  }
}

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

interface RecognitionJobsContextValue {
  active: RecognitionJob[];
  recent: RecognitionJob[]; // только сегодня, terminal статусы
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

const RecognitionJobsContext =
  React.createContext<RecognitionJobsContextValue | null>(null);

interface ProviderProps {
  children: React.ReactNode;
}

export function RecognitionJobsProvider({ children }: ProviderProps) {
  const workspaceId = getWorkspaceId();
  const router = useRouter();

  const activeQ = useQuery({
    queryKey: ["recognition-jobs", "active", workspaceId],
    queryFn: () =>
      recognitionJobsApi.list(workspaceId, { status: ACTIVE_STATUSES }),
    refetchInterval: POLL_ACTIVE_MS,
    staleTime: 0,
  });

  const recentQ = useQuery({
    queryKey: ["recognition-jobs", "recent", workspaceId],
    queryFn: () =>
      recognitionJobsApi.list(workspaceId, { status: TERMINAL_STATUSES }),
    refetchInterval: POLL_RECENT_MS,
    staleTime: 0,
  });

  const active = React.useMemo(
    () => activeQ.data ?? [],
    [activeQ.data],
  );

  const recent = React.useMemo(
    () => (recentQ.data ?? []).filter((j) => isToday(j.completed_at)),
    [recentQ.data],
  );

  // Detect status transitions: <не-terminal> → done|failed|cancelled. Toast
  // должен ругнуться один раз — поэтому помним предыдущие статусы.
  const prevStatuses = React.useRef<Map<string, RecognitionJobStatus>>(
    new Map(),
  );
  // На первом рендере у всех job уже есть «start» статус — toast не показываем
  // для уже terminal jobs, которые в первой загрузке. Их id сразу в seen.
  const seedRef = React.useRef(false);

  const goToEstimate = React.useCallback(
    (id: string) => router.push(`/estimates/${id}`),
    [router],
  );

  React.useEffect(() => {
    const all = [...active, ...recent];
    if (!seedRef.current) {
      for (const j of all) prevStatuses.current.set(j.id, j.status);
      seedRef.current = true;
      return;
    }

    for (const job of all) {
      const prev = prevStatuses.current.get(job.id);
      const isTerminal =
        job.status === "done" ||
        job.status === "failed" ||
        job.status === "cancelled";

      // Переход «было активным» → terminal. Если prev неизвестен (новый
      // terminal job) — не показываем toast (это история, не свежее событие).
      if (prev && prev !== job.status && isTerminal) {
        showRecognitionToast(job, { goToEstimate });
        playDingIfEnabled();
      }
      prevStatuses.current.set(job.id, job.status);
    }
  }, [active, recent, goToEstimate]);

  // Unread tracking: terminal jobs, не помеченные как прочитанные.
  const [readIds, setReadIds] = React.useState<Set<string>>(() =>
    loadReadIds(),
  );

  // При появлении новых terminal jobs сохраняем в localStorage только тот
  // подсет, что сейчас «recent» — старые id (вчерашние) удаляем.
  React.useEffect(() => {
    if (recent.length === 0) return;
    const recentIds = new Set(recent.map((j) => j.id));
    setReadIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) if (recentIds.has(id)) next.add(id);
      if (next.size === prev.size) return prev;
      persistReadIds(next);
      return next;
    });
  }, [recent]);

  const markRead = React.useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      persistReadIds(next);
      return next;
    });
  }, []);

  const markAllRead = React.useCallback(() => {
    setReadIds((prev) => {
      const ids = recent.map((j) => j.id);
      let changed = false;
      const next = new Set(prev);
      for (const id of ids) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      if (!changed) return prev;
      persistReadIds(next);
      return next;
    });
  }, [recent]);

  const unreadCount = React.useMemo(
    () => recent.reduce((acc, j) => (readIds.has(j.id) ? acc : acc + 1), 0),
    [recent, readIds],
  );

  const value = React.useMemo<RecognitionJobsContextValue>(
    () => ({ active, recent, unreadCount, markRead, markAllRead }),
    [active, recent, unreadCount, markRead, markAllRead],
  );

  return (
    <RecognitionJobsContext.Provider value={value}>
      {children}
    </RecognitionJobsContext.Provider>
  );
}

export function useRecognitionJobs(): RecognitionJobsContextValue {
  const ctx = React.useContext(RecognitionJobsContext);
  if (!ctx)
    throw new Error(
      "useRecognitionJobs must be used inside <RecognitionJobsProvider>",
    );
  return ctx;
}
