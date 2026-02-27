import { FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface InvoiceFilePreviewProps {
  url: string | null;
  className?: string;
}

function isPdf(url: string): boolean {
  return url.toLowerCase().endsWith('.pdf') || url.includes('/pdf');
}

function isImage(url: string): boolean {
  return /\.(png|jpg|jpeg|gif|webp|bmp|tiff)$/i.test(url);
}

/**
 * DRF возвращает абсолютный URL (http://localhost:8000/media/...).
 * Для работы через Vite proxy нужен относительный путь (/media/...).
 */
function toRelativeUrl(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.origin !== window.location.origin) {
      return parsed.pathname;
    }
  } catch {
    // не URL — вернуть как есть
  }
  return url;
}

export function InvoiceFilePreview({ url, className = '' }: InvoiceFilePreviewProps) {
  if (!url) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <FileText className="w-12 h-12 mb-3 opacity-40" />
          <p className="text-sm">Файл не загружен</p>
        </CardContent>
      </Card>
    );
  }

  const fileUrl = toRelativeUrl(url);

  return (
    <Card className={`h-full flex flex-col ${className}`}>
      <CardHeader className="py-2 px-3 flex-none">
        <CardTitle className="text-sm flex items-center justify-between">
          Документ
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline font-normal"
          >
            Открыть в новом окне
          </a>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-1 flex-1 min-h-0">
        {isPdf(fileUrl) ? (
          <iframe
            src={fileUrl}
            className="w-full h-full min-h-[600px] rounded border"
            title="Счёт (PDF)"
          />
        ) : isImage(fileUrl) ? (
          <img
            src={fileUrl}
            alt="Счёт"
            className="w-full object-contain max-h-full rounded"
          />
        ) : (
          <iframe
            src={fileUrl}
            className="w-full h-full min-h-[600px] rounded border"
            title="Документ"
          />
        )}
      </CardContent>
    </Card>
  );
}
