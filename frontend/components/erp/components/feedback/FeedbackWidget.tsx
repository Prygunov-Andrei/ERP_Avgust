'use client';

import { useState, useCallback, useEffect } from 'react';
import { MessageSquareText, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useERPAuth } from '@/hooks/useERPAuth';
import { FeedbackForm } from './FeedbackForm';
import { FeedbackThread } from './FeedbackThread';
import { FeedbackStatusBadge } from './FeedbackStatusBadge';
import type {
  FeedbackSection,
  FeedbackStatus,
  SectionFeedback,
  SectionFeedbackListItem,
} from '@/lib/api/types';

interface FeedbackWidgetProps {
  section: FeedbackSection;
}

export function FeedbackWidget({ section }: FeedbackWidgetProps) {
  const { user } = useERPAuth();
  const [items, setItems] = useState<SectionFeedbackListItem[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<SectionFeedback | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const currentUserId = (user as Record<string, unknown>)?.id as number | undefined;
  const isStaff = Boolean((user as Record<string, unknown>)?.is_staff);

  const loadItems = useCallback(async () => {
    try {
      const data = await api.sectionFeedback.list({ section, page_size: 50 });
      setItems(data.results);
    } catch (err) {
      console.error('Failed to load feedback:', err);
    } finally {
      setIsLoading(false);
    }
  }, [section]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleExpand = useCallback(async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedDetail(null);
      return;
    }
    setExpandedId(id);
    try {
      const detail = await api.sectionFeedback.get(id);
      setExpandedDetail(detail);
    } catch {
      toast.error('Не удалось загрузить тред');
      setExpandedId(null);
    }
  }, [expandedId]);

  const handleCreate = useCallback(async (text: string, files: File[]) => {
    try {
      const created = await api.sectionFeedback.create({ section, text });
      // Загружаем скриншоты
      for (const file of files) {
        await api.sectionFeedback.uploadAttachment(created.id, file);
      }
      toast.success('Замечание отправлено');
      loadItems();
    } catch (err) {
      toast.error('Не удалось отправить замечание');
      throw err;
    }
  }, [section, loadItems]);

  const handleReply = useCallback(async (feedbackId: number, text: string, files: File[]) => {
    try {
      const reply = await api.sectionFeedback.createReply(feedbackId, text);
      // Загружаем скриншоты к ответу
      for (const file of files) {
        await api.sectionFeedback.uploadReplyAttachment(reply.id, file);
      }
      // Перезагружаем детали треда
      const detail = await api.sectionFeedback.get(feedbackId);
      setExpandedDetail(detail);
      // Обновляем список (reply_count)
      loadItems();
      toast.success('Ответ отправлен');
    } catch {
      toast.error('Не удалось отправить ответ');
    }
  }, [loadItems]);

  const handleStatusChange = useCallback(async (id: number, status: FeedbackStatus) => {
    try {
      await api.sectionFeedback.updateStatus(id, status);
      loadItems();
      if (expandedId === id) {
        const detail = await api.sectionFeedback.get(id);
        setExpandedDetail(detail);
      }
      toast.success('Статус обновлён');
    } catch {
      toast.error('Не удалось обновить статус');
    }
  }, [loadItems, expandedId]);

  const handleDelete = useCallback(async (id: number) => {
    if (!confirm('Удалить замечание?')) return;
    try {
      await api.sectionFeedback.delete(id);
      if (expandedId === id) {
        setExpandedId(null);
        setExpandedDetail(null);
      }
      loadItems();
      toast.success('Замечание удалено');
    } catch {
      toast.error('Не удалось удалить');
    }
  }, [loadItems, expandedId]);

  return (
    <div className="mb-6 border border-border rounded-lg bg-card">
      {/* Заголовок */}
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <MessageSquareText className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-sm">Замечания и предложения</h3>
        {items.length > 0 && (
          <span className="text-xs text-muted-foreground">({items.length})</span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Форма создания */}
        <FeedbackForm
          onSubmit={handleCreate}
          placeholder="Нашли баг или есть предложение? Опишите здесь..."
        />

        {/* Список замечаний */}
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length > 0 ? (
          <div className="space-y-2">
            {items.map(item => (
              <div key={item.id}>
                {/* Превью замечания */}
                <button
                  type="button"
                  onClick={() => handleExpand(item.id)}
                  className="w-full text-left px-3 py-2.5 rounded-md border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{item.author_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                        <FeedbackStatusBadge status={item.status} />
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{item.text}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.reply_count > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {item.reply_count} отв.
                        </span>
                      )}
                      {expandedId === item.id ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Развёрнутый тред */}
                {expandedId === item.id && expandedDetail && (
                  <div className="mt-2">
                    <FeedbackThread
                      feedback={expandedDetail}
                      isStaff={isStaff}
                      currentUserId={currentUserId}
                      onStatusChange={handleStatusChange}
                      onReply={handleReply}
                      onDelete={handleDelete}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
