'use client';

import { useCallback, useRef, useState } from 'react';

export const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export interface UploadZoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
  selectedFileName?: string | null;
}

export interface UploadValidationError {
  code: 'wrong-type' | 'too-large';
  message: string;
}

export function validateFile(file: File): UploadValidationError | null {
  const isPdfMime = file.type === 'application/pdf';
  const isPdfExt = /\.pdf$/i.test(file.name);
  if (!isPdfMime && !isPdfExt) {
    return {
      code: 'wrong-type',
      message: 'Загружайте только PDF-файлы (.pdf).',
    };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      code: 'too-large',
      message: `Файл больше ${MAX_FILE_SIZE_MB} МБ. Уменьшите размер или разбейте на части.`,
    };
  }
  return null;
}

export default function UploadZone({
  onFile,
  disabled = false,
  selectedFileName,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      const err = validateFile(file);
      if (err) {
        setError(err.message);
        return;
      }
      setError(null);
      onFile(file);
    },
    [onFile],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (disabled) return;
      const f = e.dataTransfer.files?.[0];
      if (f) handleFile(f);
    },
    [disabled, handleFile],
  );

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) handleFile(f);
      // Сбрасываем value, чтобы можно было выбрать тот же файл повторно
      // после reset state machine.
      e.target.value = '';
    },
    [handleFile],
  );

  const openPicker = useCallback(() => {
    if (disabled) return;
    inputRef.current?.click();
  }, [disabled]);

  return (
    <div>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Загрузить PDF: перетащите файл или нажмите для выбора"
        aria-disabled={disabled || undefined}
        data-testid="ismeta-upload-zone"
        onClick={openPicker}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPicker();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        style={{
          border: `2px dashed hsl(var(--rt-${
            dragActive ? 'accent' : 'border-subtle'
          }))`,
          borderRadius: 12,
          padding: '40px 24px',
          textAlign: 'center',
          background: dragActive
            ? 'hsl(var(--rt-accent) / 0.06)'
            : 'hsl(var(--rt-paper))',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          transition: 'border-color 120ms, background 120ms',
        }}
      >
        <div
          aria-hidden
          style={{
            fontSize: 40,
            lineHeight: 1,
            marginBottom: 12,
            color: 'hsl(var(--rt-ink-40))',
          }}
        >
          📄
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: 'hsl(var(--rt-ink))',
            marginBottom: 6,
          }}
        >
          {selectedFileName
            ? `Выбран: ${selectedFileName}`
            : 'Перетащите PDF сюда'}
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'hsl(var(--rt-ink-60))',
          }}
        >
          {selectedFileName
            ? 'Кликните, чтобы выбрать другой файл'
            : 'или нажмите, чтобы выбрать файл'}
        </div>
        <div
          style={{
            marginTop: 12,
            fontSize: 12,
            color: 'hsl(var(--rt-ink-40))',
          }}
        >
          PDF · максимум {MAX_FILE_SIZE_MB} МБ
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={onChange}
          disabled={disabled}
          aria-hidden
          tabIndex={-1}
          style={{ display: 'none' }}
          data-testid="ismeta-file-input"
        />
      </div>
      {error && (
        <div
          role="alert"
          data-testid="ismeta-upload-error"
          style={{
            marginTop: 10,
            padding: '10px 12px',
            borderRadius: 8,
            background: 'hsl(0 75% 95%)',
            color: 'hsl(0 60% 35%)',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
