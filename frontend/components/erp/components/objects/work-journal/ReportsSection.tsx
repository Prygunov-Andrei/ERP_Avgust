import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, WorklogReport, PaginatedResponse } from '@/lib/api';
import { formatDateTime, cn } from '@/lib/utils';
import { CONSTANTS } from '@/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, FileText, FileSpreadsheet, Image, Filter, Eye, MessageCircle, Send, Camera, Video, Mic, FileQuestion, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { PaginationBar } from './PaginationBar';

interface ReportsSectionProps {
  data: PaginatedResponse<WorklogReport> | undefined;
  isLoading: boolean;
  page: number;
  onPageChange: (p: number) => void;
  typeFilter: string;
  onTypeFilterChange: (f: string) => void;
  onReportClick?: (reportId: string) => void;
}

export function ReportsSection({ data, isLoading, page, onPageChange, typeFilter, onTypeFilterChange, onReportClick }: ReportsSectionProps) {
  const reportTypeLabels: Record<string, string> = { intermediate: 'Промежуточный', final: 'Итоговый', supplement: 'Дополнение' };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-gray-400" />
        <select className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" value={typeFilter} onChange={(e) => { onTypeFilterChange(e.target.value); onPageChange(1); }} aria-label="Фильтр по типу отчёта">
          <option value="">Все типы</option>
          <option value="intermediate">Промежуточные</option>
          <option value="final">Итоговые</option>
          <option value="supplement">Дополнения</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : !data || data.results.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Нет отчётов{typeFilter ? ' с выбранным фильтром' : ''}</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">No</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Тип</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Звено</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Медиа</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Создан</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.results.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => onReportClick?.(report.id)} tabIndex={0} role="button" aria-label={`Открыть отчёт #${report.report_number}`} onKeyDown={(e) => { if (e.key === 'Enter') onReportClick?.(report.id); }}>
                    <td className="px-6 py-4 text-sm font-mono text-gray-900">#{report.report_number}</td>
                    <td className="px-6 py-4 text-sm">
                      <Badge className={cn('text-xs', report.report_type === 'final' ? 'bg-green-100 text-green-700' : report.report_type === 'intermediate' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600')}>
                        {reportTypeLabels[report.report_type] || report.report_type}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{report.team_name || '—'}</td>
                    <td className="px-6 py-4 text-sm text-center text-gray-700">{report.media_count}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{report.status}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{formatDateTime(report.created_at)}</td>
                    <td className="px-6 py-4"><Button variant="ghost" size="sm" aria-label="Просмотр" tabIndex={-1}><Eye className="w-4 h-4" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar count={data.count} page={page} pageSize={10} onPageChange={onPageChange} />
        </div>
      )}
    </div>
  );
}

// ---- Report Detail Dialog ----

interface ReportDetailDialogProps {
  reportId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportDetailDialog({ reportId, open, onOpenChange }: ReportDetailDialogProps) {
  const queryClient = useQueryClient();
  const [questionText, setQuestionText] = useState('');
  const [answerTexts, setAnswerTexts] = useState<Record<string, string>>({});

  const { data: report, isLoading } = useQuery({
    queryKey: ['worklog-report-detail', reportId],
    queryFn: () => api.worklog.getWorklogReportDetail(reportId!),
    enabled: !!reportId && open,
    staleTime: CONSTANTS.QUERY_STALE_TIME_MS,
  });

  const askMutation = useMutation({
    mutationFn: (text: string) => api.worklog.createWorklogQuestion({ report_id: reportId!, text }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['worklog-report-detail', reportId] }); setQuestionText(''); toast.success('Вопрос отправлен'); },
    onError: () => toast.error('Ошибка при отправке вопроса'),
  });

  const answerMutation = useMutation({
    mutationFn: ({ questionId, text }: { questionId: string; text: string }) => api.worklog.answerWorklogQuestion(questionId, { text }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['worklog-report-detail', reportId] }); setAnswerTexts({}); toast.success('Ответ отправлен'); },
    onError: () => toast.error('Ошибка при отправке ответа'),
  });

  const reportTypeLabels: Record<string, string> = { intermediate: 'Промежуточный', final: 'Итоговый', supplement: 'Дополнение' };
  const mediaTypeIcon: Record<string, typeof Camera> = { photo: Camera, video: Video, voice: Mic, audio: Mic, text: FileText, document: FileSpreadsheet };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{report ? `${reportTypeLabels[report.report_type] || report.report_type} отчёт #${report.report_number}` : 'Отчёт'}</DialogTitle>
          <DialogDescription>{report?.team_name ? `Звено: ${report.team_name}` : ''}{report?.created_at ? ` • ${formatDateTime(report.created_at)}` : ''}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
        ) : report ? (
          <div className="space-y-6 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center"><div className="text-lg font-bold text-gray-900">{report.media_count}</div><div className="text-xs text-gray-500">Медиа</div></div>
              <div className="bg-gray-50 rounded-lg p-3 text-center"><div className="text-lg font-bold text-gray-900">{report.questions?.length || 0}</div><div className="text-xs text-gray-500">Вопросы</div></div>
              <div className="bg-gray-50 rounded-lg p-3 text-center"><div className="text-lg font-bold text-gray-900">{report.status}</div><div className="text-xs text-gray-500">Статус</div></div>
            </div>

            {report.media_items && report.media_items.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Image className="w-4 h-4" /> Медиа ({report.media_items.length})</h4>
                <div className="grid grid-cols-3 gap-2">
                  {report.media_items.map((item) => {
                    const IconComp = mediaTypeIcon[item.media_type] || FileText;
                    const isVisual = item.media_type === 'photo' || item.media_type === 'video';
                    return (
                      <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="aspect-square bg-gray-100 flex items-center justify-center">
                          {isVisual && item.thumbnail_url ? (<img src={item.thumbnail_url} alt="" className="w-full h-full object-cover" loading="lazy" />) : (<IconComp className="w-8 h-8 text-gray-400" />)}
                        </div>
                        <div className="p-2">
                          <div className="text-xs text-gray-500 truncate">{item.author_name}</div>
                          {item.text_content && <div className="text-xs text-gray-600 truncate mt-0.5">{item.text_content}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><MessageCircle className="w-4 h-4" /> Вопросы и ответы</h4>
              {report.questions && report.questions.length > 0 ? (
                <div className="space-y-3">
                  {report.questions.map((q) => (
                    <div key={q.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <div className={cn('mt-0.5', q.status === 'answered' ? 'text-green-500' : 'text-amber-500')}>
                          {q.status === 'answered' ? <CheckCircle2 className="w-4 h-4" /> : <FileQuestion className="w-4 h-4" />}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm text-gray-900">{q.text}</div>
                          <div className="text-xs text-gray-400 mt-1">{q.author_name} • {formatDateTime(q.created_at)}</div>
                        </div>
                      </div>
                      {q.answers && q.answers.map((a) => (
                        <div key={a.id} className="ml-6 mt-2 pl-3 border-l-2 border-blue-200">
                          <div className="text-sm text-gray-700">{a.text}</div>
                          <div className="text-xs text-gray-400 mt-1">{a.author_name} • {formatDateTime(a.created_at)}</div>
                        </div>
                      ))}
                      {q.status === 'pending' && (
                        <div className="ml-6 mt-2 flex gap-2">
                          <Input placeholder="Ответить..." value={answerTexts[q.id] || ''} onChange={(e) => setAnswerTexts((prev) => ({ ...prev, [q.id]: e.target.value }))} className="text-sm" aria-label={`Ответ на вопрос: ${q.text}`} />
                          <Button size="sm" disabled={!answerTexts[q.id]?.trim() || answerMutation.isPending} onClick={() => { const text = answerTexts[q.id]?.trim(); if (text) answerMutation.mutate({ questionId: q.id, text }); }} aria-label="Отправить ответ"><Send className="w-4 h-4" /></Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (<p className="text-sm text-gray-400">Вопросов нет</p>)}

              <div className="mt-3 flex gap-2">
                <Input placeholder="Задать вопрос по отчёту..." value={questionText} onChange={(e) => setQuestionText(e.target.value)} className="text-sm" aria-label="Задать новый вопрос" />
                <Button size="sm" disabled={!questionText.trim() || askMutation.isPending} onClick={() => { if (questionText.trim()) askMutation.mutate(questionText.trim()); }} aria-label="Отправить вопрос"><Send className="w-4 h-4" /></Button>
              </div>
            </div>
          </div>
        ) : (<p className="text-gray-500 text-center py-4">Не удалось загрузить отчёт</p>)}
      </DialogContent>
    </Dialog>
  );
}
