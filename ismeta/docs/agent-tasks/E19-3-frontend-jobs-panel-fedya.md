# ТЗ: E19-3 — Frontend: глобальный jobs panel + nav-bar badge + toast on finish (IS-Федя)

**Команда:** IS-Федя.
**Ветка:** `ismeta/e19-3-jobs-panel`.
**Worktree:** `ERP_Avgust_is_fedya_e19_3` (создаст PO от `origin/main` после merge E19-2).
**Приоритет:** 🟢 feature E19. Зависимость: **E19-1 + E19-2 в main**.
**Срок:** ~1.5-2 дня.

> **ВАЖНО — независимость от E18 (LLM-профили).** E18 ещё не сделан, поэтому:
> - **Dropdown «Модель распознавания»** в `PdfImportDialog` (в master spec E18-3) — **НЕ ДЕЛАЕМ** в этом ТЗ. PO выбирает модель пока через `.env` recognition (DeepSeek V4-Pro thinking high). Когда E18-3 появится — Федя добавит dropdown отдельным task'ом.
> - **`profile_name`** в `RecognitionJob` API будет null (бэкенд возвращает только `profile_id` IntegerField). В UI показываем модель из `llm_costs.extract.model` если есть, иначе `—`.
> - **`llm_costs`** от recognition пока приходит `{}` placeholder (заполнится в E18-1). В UI: «Стоимость: —» с tooltip «не доступно (не настроена pricing-таблица)». Не падать на null.
> - **Settings page «Модели LLM»** (CRUD профилей) — **не делаем** — это E18-3.
> - **`generate_pros_cons`** Anthropic action из admin — нет (это AC Rating, не наша зона).
>
> **Что остаётся в этом ТЗ E19-3:** глобальный jobs panel + nav-bar badge + toast on finish + estimate banner + settings toggle звука + PdfImportDialog rework (без profile dropdown). Это полноценный E19 UX без E18 интеграции.

---

## Контекст

Master spec: [`ismeta/specs/17-background-recognition-jobs.md`](../../specs/17-background-recognition-jobs.md) — прочитай раздел **UX flow** ПОЛНОСТЬЮ.

Backend готов:
- `POST /api/v1/estimates/{id}/import/pdf/?async=true` → 202 + `RecognitionJob` JSON.
- `GET /api/v1/recognition-jobs/?status=running,queued` → list.
- `GET /api/v1/recognition-jobs/{id}/` → detail.
- `POST /api/v1/recognition-jobs/{id}/cancel/`.

---

## Задача

### 1. Types

**Файл:** `ismeta/frontend/lib/api/types.ts`.

```typescript
export type RecognitionJobStatus = "queued" | "running" | "done" | "failed" | "cancelled";

// Точный contract от E19-2 backend (RecognitionJobSerializer):
// apps/recognition_jobs/serializers.py — read_only_fields = fields, всегда GET-only.
export interface RecognitionJob {
  id: string;  // UUID
  estimate_id: string;  // UUID
  estimate_name: string;
  file_name: string;
  file_type: "pdf" | "excel" | "spec" | "invoice";
  // E18 not yet — profile_id всегда null на MVP. После E18-2 будет int.
  profile_id: number | null;
  status: RecognitionJobStatus;
  pages_total: number | null;
  pages_done: number;
  items_count: number;
  // pages_summary — массив объектов { page, expected_count, parsed_count, suspicious, ... }
  // от recognition. Для banner/popover можно показать aggregate "N suspicious страниц".
  pages_summary: Array<{ page: number; parsed_count: number; expected_count?: number; suspicious?: boolean }>;
  // E19-1 шлёт {} placeholder; E18-1 заполнит реальную структуру с extract/multimodal/total_usd.
  llm_costs: { extract?: { model: string; total_tokens?: number }; total_usd?: number } | Record<string, never>;
  error_message: string;
  // apply_result — { items_created, sections_created, ... } от apply_parsed_items.
  // Для UI можно показать "199 позиций добавлено в смету".
  apply_result: { items_created?: number; sections_created?: number } | Record<string, never>;
  is_active: boolean;
  duration_seconds: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}
```

> **Backend contract:**
> - `items` (тяжёлый, тысячи позиций) **НЕ возвращается** API намеренно — applies в смету через callback handler. Frontend читает items уже из `EstimateItem` после `done`.
> - Все поля `read_only` — POST/PATCH через ViewSet нет. Создание job — через `POST /api/v1/estimates/{id}/import/pdf/?async=true` (см. п.7 PdfImportDialog rework).
> - `cancel` action возвращает `{"id": "...", "status": "cancelled"}` (или 409 если уже terminal).

### 2. API client

**Файл:** `ismeta/frontend/lib/api/services/recognition-jobs.ts` (новый).

```typescript
export const recognitionJobsApi = {
  list: (params?: { status?: string; estimate_id?: number }): Promise<RecognitionJob[]> =>
    api.get("/recognition-jobs/", { params }),
  retrieve: (id: string): Promise<RecognitionJob> => api.get(`/recognition-jobs/${id}/`),
  cancel: (id: string): Promise<{ id: string; status: string }> =>
    api.post(`/recognition-jobs/${id}/cancel/`),
};
```

### 3. Global context + polling

**Файл:** `ismeta/frontend/contexts/recognition-jobs-context.tsx` (новый).

```typescript
"use client";
import { createContext, useContext, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/use-toast";

interface Ctx {
  active: RecognitionJob[];
  recent: RecognitionJob[]; // todays done/failed/cancelled
  unreadCount: number;
  markRead: (id: string) => void;
}

const RecognitionJobsContext = createContext<Ctx | null>(null);

export function RecognitionJobsProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const prevStatuses = useRef<Map<string, RecognitionJobStatus>>(new Map());
  
  const { data: active = [] } = useQuery({
    queryKey: ["recognition-jobs", "active"],
    queryFn: () => recognitionJobsApi.list({ status: "queued,running" }),
    refetchInterval: 5000,
  });
  
  const { data: recent = [] } = useQuery({
    queryKey: ["recognition-jobs", "recent"],
    queryFn: () => recognitionJobsApi.list({ status: "done,failed,cancelled" }),
    refetchInterval: 10000,
    select: (data) => data.filter(j => isToday(j.completed_at)),
  });
  
  // Detect transitions running → done|failed|cancelled, fire toast
  useEffect(() => {
    for (const job of [...active, ...recent]) {
      const prev = prevStatuses.current.get(job.id);
      if (prev && prev === "running" && job.status !== "running") {
        showToastForCompletion(job);
        // Sound (если включён в settings)
        playSoundIfEnabled();
      }
      prevStatuses.current.set(job.id, job.status);
    }
  }, [active, recent]);
  
  // ...
  return <RecognitionJobsContext.Provider value={...}>{children}</RecognitionJobsContext.Provider>;
}

export const useRecognitionJobs = () => {
  const ctx = useContext(RecognitionJobsContext);
  if (!ctx) throw new Error("useRecognitionJobs must be inside Provider");
  return ctx;
};
```

Подключить `<RecognitionJobsProvider>` в `app/layout.tsx` (под общим `<QueryClientProvider>`).

### 4. Nav-bar badge + popover

**Файл:** `components/layout/recognition-jobs-indicator.tsx` (новый).

- Иконка `Loader2` (lucide) с pulsing animation если есть active.
- Бейдж с цифрой `active.length` справа сверху.
- При наличии recent с unread → grey check icon с цифрой.
- Click → `Popover` (shadcn) с двумя секциями:

```tsx
<Popover>
  <PopoverTrigger>
    <Button variant="ghost" size="icon">
      {active.length > 0 ? <Loader2 className="animate-spin" /> : <Check />}
      {totalCount > 0 && <Badge>{totalCount}</Badge>}
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-96">
    {active.length > 0 && (
      <Section title="В работе">
        {active.map(job => <ActiveJobRow job={job} />)}
      </Section>
    )}
    {recent.length > 0 && (
      <Section title="Завершено сегодня">
        {recent.map(job => <RecentJobRow job={job} />)}
      </Section>
    )}
  </PopoverContent>
</Popover>
```

`<ActiveJobRow>`: estimate name + file name + progress (`pages_done / pages_total`) + кнопки `[Открыть]` `[Отменить]`.
`<RecentJobRow>`: status icon (✓ / ✗ / ⊘) + items count + duration + cost + `[Открыть]`.

«Отменить» — `confirm()` modal: «Распознавание прервётся, плата за уже использованные токены сохраняется. Продолжить?»

Поместить indicator в `components/layout/header.tsx` рядом с user menu.

### 5. Toast при завершении

**Утилита:** `lib/recognition-toast.tsx`.

```tsx
function showToastForCompletion(job: RecognitionJob) {
  if (job.status === "done") {
    // E18 не сделан — profile_name отсутствует. Берём model из llm_costs если
    // есть, иначе "—". llm_costs.total_usd может быть 0 (placeholder E19-1).
    const modelName = job.llm_costs?.extract?.model ?? "—";
    const cost = job.llm_costs?.total_usd ?? 0;
    const costStr = cost > 0 ? `$${cost.toFixed(2)}` : "—";
    toast({
      duration: 10000,
      title: `✓ ${job.estimate_name}`,
      description: (
        <div>
          <div>{job.items_count} позиций распознано</div>
          <div className="text-xs text-muted-foreground mt-1">
            {modelName} · {costStr}
          </div>
        </div>
      ),
      action: (
        <ToastAction altText="Открыть смету" onClick={() => router.push(`/estimates/${job.estimate}`)}>
          Открыть смету
        </ToastAction>
      ),
    });
  } else if (job.status === "failed") {
    toast({
      variant: "destructive",
      duration: 15000,
      title: `✗ ${job.estimate_name}`,
      description: `Ошибка: ${job.error_message || "распознавание не удалось"}`,
      action: <ToastAction altText="Повторить" onClick={() => retry(job)}>Повторить</ToastAction>,
    });
  } else if (job.status === "cancelled") {
    toast({
      title: `⊘ ${job.estimate_name}`,
      description: "Распознавание отменено",
    });
  }
}
```

**Правило:** «модель + цена» всегда мелким серым шрифтом (`text-xs text-muted-foreground`), не должны притягивать взгляд — это справочная мета.

### 6. Звуковой сигнал (опционально, выключен по умолчанию)

В user profile / settings — toggle «Звуковой сигнал при завершении распознавания».
- Хранить в localStorage (на MVP, без backend persistence).
- При завершении job: если включено → `new Audio("/sounds/ding.mp3").play()`.

Файл `public/sounds/ding.mp3` — короткий ~0.5 сек звук (free-use library).

### 7. PdfImportDialog rework

**Файл:** `components/estimate/pdf-import-dialog.tsx`.

После submit:
```typescript
// E19-2 hotfix: backend default sync. Async — только при явном ?async=true.
// Backend возвращает 202 + RecognitionJob JSON (status="queued").
const job = await api.post<RecognitionJob>(
  `/estimates/${estimateId}/import/pdf/?async=true`,
  formData
);
toast({
  description: `Распознавание "${file.name}" запущено. Можете продолжать работу.`,
  duration: 5000,
});
qc.invalidateQueries({ queryKey: ["recognition-jobs"] });
onClose();  // моментально закрыть диалог
```

Backend дефолт без флага — sync flow (старый PdfImportResult). Если PO специально хочет sync (admin/debug) — `?async=false`.

### 8. Estimate page banner

**Файл:** `app/estimates/[id]/page.tsx` (или соответствующий).

Сверху таблицы items — банер если для этой сметы есть active job:

```tsx
const { data: jobs } = useQuery({
  queryKey: ["recognition-jobs", "for-estimate", estimateId],
  queryFn: () => recognitionJobsApi.list({ status: "queued,running", estimate_id: estimateId }),
  refetchInterval: 5000,
});

const activeJob = jobs?.[0];

{activeJob && (
  <Alert>
    <Loader2 className="animate-spin" />
    <AlertDescription>
      Распознавание: страница {activeJob.pages_done} из {activeJob.pages_total ?? "?"}
      <Progress value={(activeJob.pages_done / (activeJob.pages_total ?? 1)) * 100} />
    </AlertDescription>
  </Alert>
)}
```

После `done` — баннер «✓ Распознано N позиций за X мин», dismissable. Под основным текстом — мелким серым: модель + tokens **если** `llm_costs` есть от backend. На MVP `llm_costs` может быть пустой ({} placeholder из E19-1) — тогда строки нет, без «—». PO попросил эту мета-информацию везде где она есть, но не показывать заглушки.

После `failed` — банер с retry-кнопкой.

### 8.1 Мета-блок самой сметы (PO 2026-04-25)

В `app/estimates/[id]/page.tsx` под заголовком сметы (или в footer estimate-note компонента UI-12) — постоянная **мелкая серая строка** с last успешного RecognitionJob (`status=done` для этой сметы):

```tsx
const { data: lastJob } = useQuery({
  queryKey: ["recognition-jobs", "last-done", estimateId],
  queryFn: () => recognitionJobsApi.list({ status: "done", estimate_id: estimateId }),
  select: (jobs) => jobs[0],  // последний done
});

{lastJob && (
  <div className="text-xs text-muted-foreground">
    Распознано: {lastJob.llm_costs?.extract?.model ?? "—"} ·{" "}
    {lastJob.llm_costs?.total_usd ? `$${lastJob.llm_costs.total_usd.toFixed(2)}` : "—"} ·{" "}
    {format(lastJob.completed_at, "d MMM")}
  </div>
)}
```

Если `llm_costs` пустой/null (placeholder E19-1 без E18) — все три поля «—». На E18-1 заполнятся реально.

Источник: `GET /api/v1/recognition-jobs/?estimate_id=X&status=done` (sorted DESC by created_at — последний первый). **НЕ** делать отдельный `import-logs/` endpoint — RecognitionJob уже хранит всё.

### 9. Тесты

`__tests__/recognition-jobs-indicator.test.tsx`:
- Polling возвращает 2 active → бейдж показывает 2
- Status переход → toast вызывается с правильным текстом
- Cancel → POST /cancel → optimistic UI update

`__tests__/pdf-import-async.test.tsx`:
- Submit → POST `?async=true` → диалог закрывается → toast «запущено»

---

## Приёмочные критерии

1. ✅ Глобальный context подключён, polling каждые 5 сек.
2. ✅ Nav-bar indicator показывает active count + recent unread count.
3. ✅ Popover открывает список с прогрессом + кнопками открыть/отменить.
4. ✅ Toast при `done` с action-кнопкой «Открыть смету», visible 10 сек.
5. ✅ Toast при `failed` destructive variant + retry, 15 сек.
6. ✅ Estimate page показывает банер с прогрессом если active job для этой сметы.
7. ✅ Звуковой сигнал toggle в settings, default OFF.
8. ✅ tsc/lint/test clean.

---

## Ограничения

- **НЕ дублировать** UI primitives — `components/ui/` shadcn (Toast, Popover, Alert, Progress, Button, Badge).
- **НЕ хранить** active jobs в localStorage (БД source of truth).
- **НЕ опрашивать** detail endpoint в цикле — только list.
- **НЕ показывать** popover ниже viewport (z-index, position relative to badge).

---

## Формат отчёта

1. Ветка + hash.
2. Список изменённых/новых файлов.
3. Скрины:
   - Nav-bar с active badge
   - Popover с running/recent jobs
   - Toast завершения
   - Estimate banner с прогрессом
   - Settings → toggle звука
4. tsc/lint/test статусы.

---

## Start-prompt для Феди (копировать)

```
Добро пожаловать. Ты — IS-Федя, frontend AI-программист.

ПЕРВЫМ ДЕЛОМ:

1. Онбординг: ismeta/docs/agent-tasks/ONBOARDING.md
2. Master спека: ismeta/specs/17-background-recognition-jobs.md (ВАЖНО раздел UX flow)
3. ТЗ: ismeta/docs/agent-tasks/E19-3-frontend-jobs-panel-fedya.md

Worktree: /Users/andrei_prygunov/obsidian/avgust/ERP_Avgust_is_fedya_e19_3
Ветка: ismeta/e19-3-jobs-panel (от origin/main, убедись что E19-1 + E19-2 замержены).

Контекст: PO хочет UX background jobs. Сметчик загрузил PDF → диалог
закрывается мгновенно → toast «запущено» → шапка показывает индикатор
🔄 N → может уйти в другую смету / другой раздел / закрыть вкладку.
При завершении — большой toast «199 позиций распознано». Звук — опц.
Cancel — confirm + один клик.

Backend ready: E19-1 (recognition async + callbacks) и E19-2 (Django
RecognitionJob + worker + endpoints) — оба замержены в main. Твоя
часть — global context + nav-bar indicator + toast + estimate banner
+ settings toggle звука + PdfImportDialog rework.

ВАЖНО: E18 (LLM-профили) ещё НЕ сделан — в начале ТЗ есть отдельный
блок «ВАЖНО — независимость от E18» с актуализированным списком ЧТО
делать и ЧТО НЕ делать. Главное:
- НЕ делать dropdown «Модель распознавания» в PdfImportDialog (нет профилей)
- НЕ делать Settings page «Модели LLM» (это E18-3)
- llm_costs может приходить пустой/null — не падать, показывать «—»

Параллельно работает другая команда AC Rating (3 worktree ac-rating/*) —
НЕ заходи в backend/ac_*, frontend/app/ratings/, ac-rating/. Если
планируешь править shared файлы (frontend/app/globals.css, layout.tsx
корневой) — пинг Андрею ДО коммита.

ВАЖНО (worktree): для frontend-worktree сделай symlink node_modules:
ln -s /Users/andrei_prygunov/obsidian/avgust/ERP_Avgust/frontend/node_modules \
      /Users/andrei_prygunov/obsidian/avgust/ERP_Avgust_is_fedya_e19_3/frontend/node_modules
См. memory/feedback_worktree_node_modules.

Работай строго по ТЗ. Push в свою ветку, отчёт по формату.
```
