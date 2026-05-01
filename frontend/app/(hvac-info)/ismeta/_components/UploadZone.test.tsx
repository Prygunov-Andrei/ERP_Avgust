import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import UploadZone, { MAX_FILE_SIZE_MB, validateFile } from './UploadZone';

function makeFile(
  name: string,
  size: number,
  type = 'application/pdf',
): File {
  const file = new File([new Uint8Array(0)], name, { type });
  // jsdom вычисляет size из переданных частей — для теста переопределяем явно.
  Object.defineProperty(file, 'size', { value: size, configurable: true });
  return file;
}

describe('validateFile', () => {
  it('пропускает PDF в пределах лимита', () => {
    expect(validateFile(makeFile('spec.pdf', 1024 * 1024))).toBeNull();
  });

  it('отбраковывает не-PDF по mime-type и расширению', () => {
    const err = validateFile(makeFile('notes.txt', 10, 'text/plain'));
    expect(err?.code).toBe('wrong-type');
  });

  it('пропускает PDF без mime-type, но с расширением .pdf', () => {
    expect(validateFile(makeFile('spec.pdf', 1024, ''))).toBeNull();
  });

  it('отбраковывает PDF больше лимита', () => {
    const tooBig = makeFile('big.pdf', (MAX_FILE_SIZE_MB + 1) * 1024 * 1024);
    expect(validateFile(tooBig)?.code).toBe('too-large');
  });
});

describe('UploadZone', () => {
  it('вызывает onFile для валидного PDF', () => {
    const onFile = vi.fn();
    render(<UploadZone onFile={onFile} />);
    const input = screen.getByTestId('ismeta-file-input') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile('ok.pdf', 1024)] },
    });
    expect(onFile).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('ismeta-upload-error')).toBeNull();
  });

  it('показывает ошибку и НЕ вызывает onFile для не-PDF', () => {
    const onFile = vi.fn();
    render(<UploadZone onFile={onFile} />);
    const input = screen.getByTestId('ismeta-file-input') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile('a.txt', 100, 'text/plain')] },
    });
    expect(onFile).not.toHaveBeenCalled();
    expect(screen.getByTestId('ismeta-upload-error').textContent).toMatch(
      /PDF/i,
    );
  });

  it('показывает ошибку про размер для слишком большого файла', () => {
    const onFile = vi.fn();
    render(<UploadZone onFile={onFile} />);
    const input = screen.getByTestId('ismeta-file-input') as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [makeFile('big.pdf', (MAX_FILE_SIZE_MB + 1) * 1024 * 1024)],
      },
    });
    expect(onFile).not.toHaveBeenCalled();
    expect(screen.getByTestId('ismeta-upload-error').textContent).toMatch(
      new RegExp(`${MAX_FILE_SIZE_MB}`),
    );
  });

  it('drop-events валидируются точно так же, как клик через input', () => {
    const onFile = vi.fn();
    render(<UploadZone onFile={onFile} />);
    const zone = screen.getByTestId('ismeta-upload-zone');
    fireEvent.drop(zone, {
      dataTransfer: { files: [makeFile('drop.pdf', 2048)] },
    });
    expect(onFile).toHaveBeenCalledTimes(1);
  });

  it('disabled — клик не открывает picker', () => {
    const onFile = vi.fn();
    render(<UploadZone onFile={onFile} disabled />);
    const zone = screen.getByTestId('ismeta-upload-zone');
    expect(zone).toHaveAttribute('aria-disabled', 'true');
    // disabled-input → fireEvent.change не должен передать файл к onFile
    const input = screen.getByTestId('ismeta-file-input') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });
});
