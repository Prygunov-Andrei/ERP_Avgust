import type { PriceListList } from '@/lib/api';
import type { EstimateDetail } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, RefreshCw } from 'lucide-react';
import { UseMutationResult } from '@tanstack/react-query';

interface EstimateInfoTabProps {
  estimate: EstimateDetail;
  priceLists: PriceListList[] | undefined;
  updateFieldMutation: UseMutationResult<any, any, Record<string, unknown>, any>;
  updateStatusMutation: UseMutationResult<any, any, string, any>;
  fetchCBRMutation: UseMutationResult<any, any, void, any>;
}

const STATUS_MAP: Record<string, string> = {
  draft: 'Черновик',
  in_progress: 'В работе',
  checking: 'На проверке',
  approved: 'Утверждена',
  sent: 'Отправлена Заказчику',
  agreed: 'Согласована Заказчиком',
  rejected: 'Отклонена',
};

export function EstimateInfoTab({
  estimate,
  priceLists,
  updateFieldMutation,
  updateStatusMutation,
  fetchCBRMutation,
}: EstimateInfoTabProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Основная информация</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-500">Номер</div>
            <div className="font-medium text-gray-900">{estimate.number}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Название</div>
            <div className="font-medium text-gray-900">{estimate.name}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Объект</div>
            <div className="font-medium text-gray-900">{estimate.object_name}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Компания</div>
            <div className="font-medium text-gray-900">{estimate.legal_entity_name}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Статус</div>
            <div>
              <select
                value={estimate.status}
                onChange={(e) => updateStatusMutation.mutate(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(STATUS_MAP).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">С НДС</div>
            <div className="font-medium text-gray-900">
              {estimate.with_vat ? `Да (${estimate.vat_rate}%)` : 'Нет'}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Создал</div>
            <div className="font-medium text-gray-900">{estimate.created_by_username}</div>
          </div>
        </div>

        {estimate.projects.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="text-sm text-gray-500 mb-2">Проекты-основания</div>
            <div className="space-y-1">
              {estimate.projects.map((project: { id: number; cipher: string; name: string; file?: string }) => (
                <div key={project.id} className="text-sm">
                  {project.file ? (
                    <a
                      href={project.file}
                      download
                      className="text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      {project.cipher} - {project.name}
                    </a>
                  ) : (
                    <span className="text-gray-500">
                      {project.cipher} - {project.name} (файл отсутствует)
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Editable parameters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6" key={estimate.updated_at}>
        <h3 className="font-semibold text-gray-900 mb-4">Параметры сметы</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="detail-man-hours" className="text-sm text-gray-500">Человеко-часы</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                id="detail-man-hours"
                type="number"
                step="0.01"
                defaultValue={estimate.man_hours}
                onBlur={(e) => {
                  if (e.target.value !== estimate.man_hours) {
                    updateFieldMutation.mutate({ man_hours: e.target.value });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
                className="max-w-[200px]"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="detail-price-list" className="text-sm text-gray-500">Прайс-лист для расчёта</Label>
            <select
              id="detail-price-list"
              defaultValue={estimate.price_list || ''}
              onChange={(e) => {
                const value = e.target.value ? Number(e.target.value) : null;
                updateFieldMutation.mutate({ price_list: value });
              }}
              className="mt-1 w-full max-w-[300px] px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">Не выбрано</option>
              {priceLists?.map((pl) => (
                <option key={pl.id} value={pl.id}>{pl.number} - {pl.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <Label className="text-sm text-gray-500">Курсы валют</Label>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs gap-1"
              onClick={() => fetchCBRMutation.mutate()}
              disabled={fetchCBRMutation.isPending}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${fetchCBRMutation.isPending ? 'animate-spin' : ''}`} />
              {fetchCBRMutation.isPending ? 'Загрузка...' : 'Курсы ЦБ'}
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-1 max-w-[500px]">
            <div>
              <Label htmlFor="detail-usd" className="text-xs text-gray-400">USD</Label>
              <Input
                id="detail-usd"
                type="number"
                step="0.01"
                placeholder="—"
                defaultValue={estimate.usd_rate || ''}
                onBlur={(e) => {
                  const newVal = e.target.value || undefined;
                  if (newVal !== (estimate.usd_rate || undefined)) {
                    updateFieldMutation.mutate({ usd_rate: newVal || null });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
              />
            </div>
            <div>
              <Label htmlFor="detail-eur" className="text-xs text-gray-400">EUR</Label>
              <Input
                id="detail-eur"
                type="number"
                step="0.01"
                placeholder="—"
                defaultValue={estimate.eur_rate || ''}
                onBlur={(e) => {
                  const newVal = e.target.value || undefined;
                  if (newVal !== (estimate.eur_rate || undefined)) {
                    updateFieldMutation.mutate({ eur_rate: newVal || null });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
              />
            </div>
            <div>
              <Label htmlFor="detail-cny" className="text-xs text-gray-400">CNY</Label>
              <Input
                id="detail-cny"
                type="number"
                step="0.01"
                placeholder="—"
                defaultValue={estimate.cny_rate || ''}
                onBlur={(e) => {
                  const newVal = e.target.value || undefined;
                  if (newVal !== (estimate.cny_rate || undefined)) {
                    updateFieldMutation.mutate({ cny_rate: newVal || null });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
