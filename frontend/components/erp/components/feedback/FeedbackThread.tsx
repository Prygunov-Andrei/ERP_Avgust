'use client';

import { useState, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FeedbackStatusBadge } from './FeedbackStatusBadge';
import { FeedbackForm } from './FeedbackForm';
import type { SectionFeedback, FeedbackAttachment, FeedbackStatus } from '@/lib/api/types';

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function AttachmentList({ attachments }: { attachments: FeedbackAttachment[] }) {
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  if (!attachments.length) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2 mt-2">
        {attachments.map(a => (
          <button
            key={a.id}
            type="button"
            onClick={() => setViewingImage(a.url)}
            className="block"
          >
            <img
              src={a.url}
              alt={a.original_filename}
              className="w-20 h-20 object-cover rounded border hover:opacity-80 transition-opacity"
            />
          </button>
        ))}
      </div>
      {viewingImage && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setViewingImage(null)}
        >
          <img
            src={viewingImage}
            alt="Screenshot"
            className="max-w-full max-h-full rounded shadow-lg"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

interface FeedbackThreadProps {
  feedback: SectionFeedback;
  isStaff?: boolean;
  currentUserId?: number;
  onStatusChange: (id: number, status: FeedbackStatus) => Promise<void>;
  onReply: (feedbackId: number, text: string, files: File[]) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
}

export function FeedbackThread({
  feedback,
  isStaff,
  currentUserId,
  onStatusChange,
  onReply,
  onDelete,
}: FeedbackThreadProps) {
  const canDelete = isStaff || feedback.author === currentUserId;

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-card">
      {/* Оригинальное замечание */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium text-sm truncate">{feedback.author_name}</span>
            <span className="text-xs text-muted-foreground shrink-0">{formatDate(feedback.created_at)}</span>
            <FeedbackStatusBadge
              status={feedback.status}
              isStaff={isStaff}
              onStatusChange={s => onStatusChange(feedback.id, s)}
            />
          </div>
          {canDelete && onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-muted-foreground hover:text-destructive h-7 w-7 p-0"
              onClick={() => onDelete(feedback.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
        <p className="mt-2 text-sm whitespace-pre-wrap">{feedback.text}</p>
        <AttachmentList attachments={feedback.attachments} />
      </div>

      {/* Ответы */}
      {feedback.replies.length > 0 && (
        <div className="border-l-2 border-muted pl-4 space-y-3">
          {feedback.replies.map(reply => (
            <div key={reply.id}>
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{reply.author_name}</span>
                <span className="text-xs text-muted-foreground">{formatDate(reply.created_at)}</span>
              </div>
              <p className="mt-1 text-sm whitespace-pre-wrap">{reply.text}</p>
              <AttachmentList attachments={reply.attachments} />
            </div>
          ))}
        </div>
      )}

      {/* Форма ответа */}
      <div className="border-t pt-3">
        <FeedbackForm
          onSubmit={(text, files) => onReply(feedback.id, text, files)}
          placeholder="Написать ответ..."
          compact
        />
      </div>
    </div>
  );
}
