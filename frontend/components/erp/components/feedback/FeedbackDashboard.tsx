'use client';

import { useState, useCallback, useEffect } from 'react';
import { Loader2, MessageSquareText, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useERPAuth } from '@/hooks/useERPAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FeedbackThread } from './FeedbackThread';
import { FeedbackStatusBadge } from './FeedbackStatusBadge';
import type {
  FeedbackSection,
  FeedbackStats,
  FeedbackStatus,
  SectionFeedback,
  SectionFeedbackListItem,
  SECTION_LABELS,
} from '@/lib/api/types';
import { SECTION_LABELS as LABELS } from '@/lib/api/types';

type StatusFilter = FeedbackStatus | 'all';

export function FeedbackDashboard() {
  const { user } = useERPAuth();
  const [stats, setStats] = useState<FeedbackStats[]>([]);
  const [items, setItems] = useState<SectionFeedbackListItem[]>([]);
  const [sectionFilter, setSectionFilter] = useState<FeedbackSection | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<SectionFeedback | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const currentUserId = (user as Record<string, unknown>)?.id as number | undefined;
  const isStaff = Boolean((user as Record<string, unknown>)?.is_staff);

  const loadStats = useCallback(async () => {
    try {
      const data = await api.sectionFeedback.stats();
      setStats(data);
    } catch {
      console.error('Failed to load stats');
    }
  }, []);

  const loadItems = useCallback(async () => {
    try {
      const params: Record<string, string | number> = { page_size: 100 };
      if (sectionFilter !== 'all') params.section = sectionFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      const data = await api.sectionFeedback.list(params as Parameters<typeof api.sectionFeedback.list>[0]);
      setItems(data.results);
    } catch {
      console.error('Failed to load items');
    } finally {
      setIsLoading(false);
    }
  }, [sectionFilter, statusFilter]);

  useEffect(() => {
    loadStats();
    loadItems();
  }, [loadStats, loadItems]);

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

  const handleReply = useCallback(async (feedbackId: number, text: string, files: File[]) => {
    try {
      const reply = await api.sectionFeedback.createReply(feedbackId, text);
      for (const file of files) {
        await api.sectionFeedback.uploadReplyAttachment(reply.id, file);
      }
      const detail = await api.sectionFeedback.get(feedbackId);
      setExpandedDetail(detail);
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
      loadStats();
      if (expandedId === id) {
        const detail = await api.sectionFeedback.get(id);
        setExpandedDetail(detail);
      }
      toast.success('Статус обновлён');
    } catch {
      toast.error('Не удалось обновить статус');
    }
  }, [loadItems, loadStats, expandedId]);

  const handleDelete = useCallback(async (id: number) => {
    if (!confirm('Удалить замечание?')) return;
    try {
      await api.sectionFeedback.delete(id);
      if (expandedId === id) {
        setExpandedId(null);
        setExpandedDetail(null);
      }
      loadItems();
      loadStats();
      toast.success('Замечание удалено');
    } catch {
      toast.error('Не удалось удалить');
    }
  }, [loadItems, loadStats, expandedId]);

  const totalNew = stats.reduce((sum, s) => sum + s.new, 0);
  const totalInProgress = stats.reduce((sum, s) => sum + s.in_progress, 0);
  const totalResolved = stats.reduce((sum, s) => sum + s.resolved, 0);
  const totalAll = totalNew + totalInProgress + totalResolved;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Замечания сотрудников</h1>

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Всего</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalAll}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-primary">Новых</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{totalNew}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-600">В работе</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">{totalInProgress}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Решено</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{totalResolved}</p>
          </CardContent>
        </Card>
      </div>

      {/* Фильтры */}
      <div className="flex flex-wrap items-center gap-4">
        <Select
          value={sectionFilter}
          onValueChange={v => setSectionFilter(v as FeedbackSection | 'all')}
        >
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Все разделы" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все разделы</SelectItem>
            {(Object.entries(LABELS) as [FeedbackSection, string][]).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Tabs
          value={statusFilter}
          onValueChange={v => setStatusFilter(v as StatusFilter)}
        >
          <TabsList>
            <TabsTrigger value="all">Все</TabsTrigger>
            <TabsTrigger value="new">Новые</TabsTrigger>
            <TabsTrigger value="in_progress">В работе</TabsTrigger>
            <TabsTrigger value="resolved">Решённые</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Список */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <MessageSquareText className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>Замечаний пока нет</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id}>
              <button
                type="button"
                onClick={() => handleExpand(item.id)}
                className="w-full text-left px-4 py-3 rounded-md border hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted">
                        {LABELS[item.section]}
                      </span>
                      <span className="text-sm font-medium">{item.author_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      <FeedbackStatusBadge status={item.status} />
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{item.text}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                    {item.reply_count > 0 && <span>{item.reply_count} отв.</span>}
                    {item.has_attachments && <span>📎</span>}
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </button>

              {expandedId === item.id && expandedDetail && (
                <div className="mt-2 mb-2">
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
      )}
    </div>
  );
}
