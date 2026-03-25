import React from 'react';
import { Correspondence } from '@/lib/api';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export type CorrespondenceFormData = {
  contract: string;
  type: 'incoming' | 'outgoing';
  category: 'уведомление' | 'претензия' | 'запрос' | 'ответ' | 'прочее';
  number: string;
  date: string;
  status: 'новое' | 'в работе' | 'отвечено' | 'закрыто';
  subject: string;
  description: string;
  file: File | null;
  related_to: string;
};

type CommunicationsFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  formData: CorrespondenceFormData;
  onFormDataChange: (data: CorrespondenceFormData) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isPending: boolean;
  submitLabel: string;
  pendingLabel: string;
  contracts: { id: number; number: string; name?: string }[];
  relatedCorrespondence?: Correspondence[];
  selectedCorrespondence?: Correspondence | null;
  existingFileUrl?: string;
};

export function CommunicationsFormDialog({
  open,
  onOpenChange,
  title,
  description: dialogDescription,
  formData,
  onFormDataChange,
  onSubmit,
  isPending,
  submitLabel,
  pendingLabel,
  contracts,
  relatedCorrespondence,
  selectedCorrespondence,
  existingFileUrl,
}: CommunicationsFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold mb-4">{title}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">{dialogDescription}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label>Договор *</Label>
            <Select
              value={formData.contract}
              onValueChange={(value) => onFormDataChange({ ...formData, contract: value })}
              required
            >
              <SelectTrigger><SelectValue placeholder="Выберите договор" /></SelectTrigger>
              <SelectContent>
                {contracts?.map((contract) => (
                  <SelectItem key={contract.id} value={contract.id.toString()}>
                    {contract.number} - {contract.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Тип *</Label>
            <Select
              value={formData.type}
              onValueChange={(value: 'incoming' | 'outgoing') => onFormDataChange({ ...formData, type: value })}
              required
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="incoming">Входящее</SelectItem>
                <SelectItem value="outgoing">Исходящее</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Категория *</Label>
            <Select
              value={formData.category}
              onValueChange={(value: string) => onFormDataChange({ ...formData, category: value as typeof formData.category })}
              required
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="уведомление">Уведомление</SelectItem>
                <SelectItem value="претензия">Претензия</SelectItem>
                <SelectItem value="запрос">Запрос</SelectItem>
                <SelectItem value="ответ">Ответ</SelectItem>
                <SelectItem value="прочее">Прочее</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Номер *</Label>
            <Input
              type="text"
              placeholder="№123/2024"
              value={formData.number}
              onChange={(e) => onFormDataChange({ ...formData, number: e.target.value })}
              required
            />
          </div>

          <div>
            <Label>Дата *</Label>
            <Input
              type="date"
              value={formData.date}
              onChange={(e) => onFormDataChange({ ...formData, date: e.target.value })}
              required
            />
          </div>

          <div>
            <Label>Тема *</Label>
            <Input
              type="text"
              placeholder="Тема письма"
              value={formData.subject}
              onChange={(e) => onFormDataChange({ ...formData, subject: e.target.value })}
              required
            />
          </div>

          <div>
            <Label>Описание</Label>
            <Textarea
              placeholder="Описание письма"
              value={formData.description}
              onChange={(e) => onFormDataChange({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div>
            <Label>Статус</Label>
            <Select
              value={formData.status}
              onValueChange={(value: string) => onFormDataChange({ ...formData, status: value as typeof formData.status })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="новое">Новое</SelectItem>
                <SelectItem value="в работе">В работе</SelectItem>
                <SelectItem value="отвечено">Отвечено</SelectItem>
                <SelectItem value="закрыто">Закрыто</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Связанное письмо (опционально)</Label>
            <Select
              value={formData.related_to || 'none'}
              onValueChange={(value) => onFormDataChange({ ...formData, related_to: value === 'none' ? '' : value })}
            >
              <SelectTrigger><SelectValue placeholder="Не связано" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Не связано</SelectItem>
                {relatedCorrespondence?.filter(c => c.id !== selectedCorrespondence?.id).map((corr) => (
                  <SelectItem key={corr.id} value={corr.id.toString()}>
                    {corr.number} - {corr.subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Файл</Label>
            <Input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                onFormDataChange({ ...formData, file });
              }}
            />
            {existingFileUrl && (
              <p className="text-xs text-muted-foreground mt-1">
                Текущий файл: <a href={existingFileUrl} target="_blank" className="text-blue-500 underline">Скачать</a>
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={isPending} className="flex-1">
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {pendingLabel}
                </>
              ) : (
                submitLabel
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Отмена
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
