import React from 'react';
import { Correspondence } from '@/lib/api';
import { Download, Edit, Trash2, ArrowDownCircle, ArrowUpCircle, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';

type CommunicationsDetailDialogProps = {
  correspondence: Correspondence | null;
  onClose: () => void;
  onEdit: (corr: Correspondence) => void;
  onDelete: (id: number) => void;
};

const getTypeLabel = (type: string) => type === 'incoming' ? 'Входящее' : 'Исходящее';

const getTypeBadge = (type: string) =>
  type === 'incoming' ? 'bg-blue-100 dark:bg-blue-900/30 text-primary' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';

const getCategoryBadge = (category: string) => {
  switch (category) {
    case 'уведомление': return 'bg-muted text-foreground';
    case 'претензия': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
    case 'запрос': return 'bg-blue-100 dark:bg-blue-900/30 text-primary';
    case 'ответ': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
    default: return 'bg-muted text-foreground';
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'новое': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
    case 'в работе': return 'bg-blue-100 dark:bg-blue-900/30 text-primary';
    case 'отвечено': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
    case 'закрыто': return 'bg-muted text-foreground';
    default: return 'bg-muted text-foreground';
  }
};

export function CommunicationsDetailDialog({
  correspondence,
  onClose,
  onEdit,
  onDelete,
}: CommunicationsDetailDialogProps) {
  if (!correspondence) return null;

  return (
    <Dialog open={!!correspondence} onOpenChange={() => onClose()}>
      <DialogContent className="bg-card rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold mb-4">Детали письма</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Подробная информация о письме
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Дата</p>
              <p className="font-medium">{formatDate(correspondence.date)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Номер</p>
              <p className="font-medium">{correspondence.number}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Тип</p>
              <Badge className={getTypeBadge(correspondence.type)}>
                {correspondence.type === 'incoming' ? (
                  <ArrowDownCircle className="w-3 h-3 mr-1 inline" />
                ) : (
                  <ArrowUpCircle className="w-3 h-3 mr-1 inline" />
                )}
                {getTypeLabel(correspondence.type)}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Категория</p>
              <Badge className={getCategoryBadge(correspondence.category)}>
                {correspondence.category}
              </Badge>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground">Договор</p>
              <p className="font-medium">{correspondence.contract_name}</p>
              <p className="text-xs text-muted-foreground">{correspondence.contract_number}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground">Статус</p>
              <Badge className={getStatusBadge(correspondence.status)}>
                {correspondence.status}
              </Badge>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-xs text-muted-foreground mb-1">Тема</p>
            <p className="font-medium">{correspondence.subject}</p>
          </div>

          {correspondence.description && (
            <div className="border-t pt-4">
              <p className="text-xs text-muted-foreground mb-1">Описание</p>
              <p className="text-sm whitespace-pre-wrap">{correspondence.description}</p>
            </div>
          )}

          {correspondence.related_to && (
            <div className="border-t pt-4">
              <p className="text-xs text-muted-foreground mb-2">Связанное письмо</p>
              <div className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">{correspondence.related_to_number}</span>
              </div>
            </div>
          )}

          {correspondence.file && (
            <div className="border-t pt-4">
              <p className="text-xs text-muted-foreground mb-2">Файл</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(correspondence.file, '_blank')}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Скачать файл
              </Button>
            </div>
          )}

          <div className="border-t pt-4 text-xs text-muted-foreground">
            <p>Создано: {formatDate(correspondence.created_at)}</p>
            <p>Обновлено: {formatDate(correspondence.updated_at)}</p>
          </div>
        </div>

        <div className="flex justify-between mt-6">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onEdit(correspondence)}
              className="flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Редактировать
            </Button>
            <Button
              variant="outline"
              onClick={() => onDelete(correspondence.id)}
              className="flex items-center gap-2 text-red-500 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4" />
              Удалить
            </Button>
          </div>
          <Button variant="outline" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Exported badge helpers for use in the list table
export { getTypeLabel, getTypeBadge, getCategoryBadge, getStatusBadge };
