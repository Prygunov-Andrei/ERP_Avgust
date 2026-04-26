import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { PdfImportDialog } from "@/components/estimate/pdf-import-dialog";
import type { RecognitionJob } from "@/lib/api/types";

// Sonner мокаем чтобы получать вызовы тостов в spy.
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

const ESTIMATE_ID = "e1";

function makeJob(overrides: Partial<RecognitionJob> = {}): RecognitionJob {
  return {
    id: "job-1",
    estimate_id: ESTIMATE_ID,
    estimate_name: "Объект A",
    file_name: "spec.pdf",
    file_type: "pdf",
    profile_id: null,
    status: "queued",
    pages_total: null,
    pages_done: 0,
    items_count: 0,
    pages_summary: [],
    llm_costs: {},
    error_message: "",
    apply_result: {},
    is_active: true,
    duration_seconds: null,
    created_at: new Date().toISOString(),
    started_at: null,
    completed_at: null,
    ...overrides,
  };
}

function jsonResponse(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function renderDialog(onOpenChange = vi.fn()) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const utils = render(
    <QueryClientProvider client={qc}>
      <PdfImportDialog
        estimateId={ESTIMATE_ID}
        open
        onOpenChange={onOpenChange}
      />
    </QueryClientProvider>,
  );
  return { ...utils, onOpenChange, qc };
}

function selectFile(name = "spec.pdf"): void {
  const input = screen.getByTestId("pdf-import-input") as HTMLInputElement;
  const file = new File(["pdf-bytes"], name, { type: "application/pdf" });
  fireEvent.change(input, { target: { files: [file] } });
}

describe("PdfImportDialog (async)", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    toastMock.toast.success.mockClear();
    toastMock.toast.error.mockClear();
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("submits with ?async=true and immediately closes the dialog", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(makeJob(), { status: 202 }));

    const { onOpenChange } = renderDialog();

    selectFile();

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toMatch(/\/estimates\/e1\/import\/pdf\/\?async=true$/);
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("shows «launched» toast with file name after successful submit", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(makeJob(), { status: 202 }));

    renderDialog();
    selectFile("ОВ-2.pdf");

    await waitFor(() =>
      expect(toastMock.toast.success).toHaveBeenCalledWith(
        expect.stringMatching(/ОВ-2\.pdf/),
        expect.objectContaining({ duration: 5_000 }),
      ),
    );
  });

  it("rejects non-PDF files locally without calling fetch", async () => {
    renderDialog();
    const input = screen.getByTestId("pdf-import-input") as HTMLInputElement;
    const file = new File(["junk"], "spec.txt", { type: "text/plain" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(toastMock.toast.error).toHaveBeenCalledWith("Нужен файл .pdf");
  });

  it("shows error toast on backend failure and stays open", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "PDF слишком большой" }), {
        status: 413,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { onOpenChange } = renderDialog();
    selectFile();

    await waitFor(() => expect(toastMock.toast.error).toHaveBeenCalled());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
