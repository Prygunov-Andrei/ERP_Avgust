import {
  TechnicalProposalDetail as TKPDetail,
} from "@/lib/api";
import type { LegalEntity, ConstructionObject, TechnicalProposalListItem } from '@/lib/api';
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FileText, Building2, Calendar, Clock, DollarSign, TrendingUp, User, FileCheck, History } from 'lucide-react';
import { formatDate, formatDateTime, formatCurrency, getStatusBadgeClass, getStatusLabel } from '@/lib/utils';

export interface EditFormData {
  name: string;
  date: string;
  due_date: string;
  outgoing_number: string;
  object: string;
  object_area: string;
  legal_entity: string;
  advance_required: string;
  work_duration: string;
  validity_days: string;
  notes: string;
}

interface InfoTabProps {
  tkp: TKPDetail;
  versions?: (TechnicalProposalListItem & { is_latest_version?: boolean })[];
  isEditing: boolean;
  editFormData: EditFormData | null;
  onFieldChange: (field: keyof EditFormData, value: string) => void;
  objects: ConstructionObject[];
  legalEntities: LegalEntity[];
}

export function InfoTab({
  tkp,
  versions,
  isEditing,
  editFormData,
  onFieldChange,
  objects,
  legalEntities,
}: InfoTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Основная информация */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <h2 className="text-foreground mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Основная информация
        </h2>
        <div className="space-y-4">
          {isEditing && editFormData ? (
            <>
              <div>
                <Label htmlFor="edit-name">Название</Label>
                <Input
                  id="edit-name"
                  value={editFormData.name}
                  onChange={(e) => onFieldChange('name', e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="edit-object">Объект</Label>
                <select
                  id="edit-object"
                  value={editFormData.object}
                  onChange={(e) => onFieldChange('object', e.target.value)}
                  className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Выберите объект</option>
                  {objects?.map((obj) => (
                    <option key={obj.id} value={obj.id}>{obj.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="edit-legal-entity">Юридическое лицо</Label>
                <select
                  id="edit-legal-entity"
                  value={editFormData.legal_entity}
                  onChange={(e) => onFieldChange('legal_entity', e.target.value)}
                  className="mt-1 w-full border rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Выберите юрлицо</option>
                  {legalEntities?.map((le) => (
                    <option key={le.id} value={le.id}>{le.short_name || le.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-date">Дата</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={editFormData.date}
                    onChange={(e) => onFieldChange('date', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-due-date">Дата выдачи (крайний срок)</Label>
                  <Input
                    id="edit-due-date"
                    type="date"
                    value={editFormData.due_date}
                    onChange={(e) => onFieldChange('due_date', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-outgoing">Исходящий номер</Label>
                  <Input
                    id="edit-outgoing"
                    value={editFormData.outgoing_number}
                    onChange={(e) => onFieldChange('outgoing_number', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-area">Площадь объекта (м²)</Label>
                  <Input
                    id="edit-area"
                    type="number"
                    value={editFormData.object_area}
                    onChange={(e) => onFieldChange('object_area', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit-validity">Срок действия (дни)</Label>
                <Input
                  id="edit-validity"
                  type="number"
                  value={editFormData.validity_days}
                  onChange={(e) => onFieldChange('validity_days', e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-advance">Требуемый аванс</Label>
                  <Input
                    id="edit-advance"
                    value={editFormData.advance_required}
                    onChange={(e) => onFieldChange('advance_required', e.target.value)}
                    className="mt-1"
                    placeholder="Например: 30%"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-duration">Срок выполнения работ</Label>
                  <Input
                    id="edit-duration"
                    value={editFormData.work_duration}
                    onChange={(e) => onFieldChange('work_duration', e.target.value)}
                    className="mt-1"
                    placeholder="Например: 14 рабочих дней"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit-notes">Примечания</Label>
                <Textarea
                  id="edit-notes"
                  value={editFormData.notes}
                  onChange={(e) => onFieldChange('notes', e.target.value)}
                  className="mt-1"
                  rows={4}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <Label className="text-muted-foreground">Объект</Label>
                <div className="mt-1 flex items-start gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground mt-1" />
                  <div>
                    <div className="text-foreground">{tkp.object_name}</div>
                    {tkp.object_address && (
                      <div className="text-muted-foreground">{tkp.object_address}</div>
                    )}
                    {tkp.object_area && (
                      <div className="text-muted-foreground">Площадь: {tkp.object_area} м²</div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Юридическое лицо</Label>
                <div className="mt-1 text-foreground">{tkp.legal_entity_name}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Дата создания</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-foreground">{formatDate(tkp.date)}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Срок действия</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-foreground">
                      {tkp.validity_days} дн. (до {formatDate(tkp.validity_date)})
                    </span>
                  </div>
                </div>
                {tkp.due_date && (
                  <div>
                    <Label className="text-muted-foreground">Дата выдачи (крайний срок)</Label>
                    <div className="mt-1 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-foreground">{formatDate(tkp.due_date)}</span>
                    </div>
                  </div>
                )}
              </div>

              {tkp.advance_required && (
                <div>
                  <Label className="text-muted-foreground">Требуемый аванс</Label>
                  <div className="mt-1 text-foreground">{formatCurrency(tkp.advance_required)}</div>
                </div>
              )}

              {tkp.work_duration && (
                <div>
                  <Label className="text-muted-foreground">Срок выполнения работ</Label>
                  <div className="mt-1 text-foreground">{tkp.work_duration}</div>
                </div>
              )}

              {tkp.notes && (
                <div>
                  <Label className="text-muted-foreground">Примечания</Label>
                  <div className="mt-1 text-foreground whitespace-pre-wrap">{tkp.notes}</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Финансовая информация */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <h2 className="text-foreground mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-600" />
          Финансовая информация
        </h2>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-primary/10 rounded-lg p-4">
            <div className="text-muted-foreground mb-1">Продажа</div>
            <div className="text-blue-900">{formatCurrency(tkp.total_amount)}</div>
          </div>

          <div className="bg-red-50 rounded-lg p-4">
            <div className="text-muted-foreground mb-1">Закупка</div>
            <div className="text-red-900">
              {formatCurrency(String(parseFloat(tkp.total_amount) - parseFloat(tkp.total_profit)))}
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-muted-foreground mb-1">Прибыль</div>
            <div className="text-green-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              {formatCurrency(tkp.total_profit)}
              <span className="text-green-700">
                ({parseFloat(tkp.profit_percent).toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>
        <div className="space-y-4">

          {tkp.total_man_hours && (
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-muted-foreground mb-1">Трудозатраты</div>
              <div className="text-purple-900 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                {parseFloat(tkp.total_man_hours).toFixed(2)} чел/час
              </div>
            </div>
          )}

          {(tkp.currency_rates.usd || tkp.currency_rates.eur || tkp.currency_rates.cny) && (
            <div>
              <Label className="text-muted-foreground mb-2 block">Курсы валют</Label>
              <div className="space-y-2">
                {tkp.currency_rates.usd && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">USD:</span>
                    <span className="text-foreground">{parseFloat(tkp.currency_rates.usd).toFixed(2)} ₽</span>
                  </div>
                )}
                {tkp.currency_rates.eur && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">EUR:</span>
                    <span className="text-foreground">{parseFloat(tkp.currency_rates.eur).toFixed(2)} ₽</span>
                  </div>
                )}
                {tkp.currency_rates.cny && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CNY:</span>
                    <span className="text-foreground">{parseFloat(tkp.currency_rates.cny).toFixed(2)} ₽</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ответственные лица и история статусов */}
      <div className="bg-card rounded-lg shadow-sm border border-border p-6">
        <h2 className="text-foreground mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-purple-600" />
          Ответственные лица
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-3 bg-muted rounded-lg">
            <Label className="text-muted-foreground text-xs">Создал</Label>
            <div className="mt-1 text-foreground font-medium">{tkp.created_by_name || '—'}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{formatDate(tkp.created_at)}</div>
          </div>

          <div className="p-3 bg-muted rounded-lg">
            <Label className="text-muted-foreground text-xs">Проверил</Label>
            <div className="mt-1 text-foreground font-medium">{tkp.checked_by_name || '—'}</div>
            {tkp.checked_at && (
              <div className="text-xs text-muted-foreground mt-0.5">{formatDate(tkp.checked_at)}</div>
            )}
          </div>

          <div className="p-3 bg-muted rounded-lg">
            <Label className="text-muted-foreground text-xs">Утвердил</Label>
            <div className="mt-1 text-foreground font-medium">{tkp.approved_by_name || '—'}</div>
            {tkp.approved_at && (
              <div className="text-xs text-muted-foreground mt-0.5">{formatDate(tkp.approved_at)}</div>
            )}
          </div>
        </div>

        {tkp.status_history && tkp.status_history.length > 0 && (
          <>
            <h3 className="text-foreground text-sm font-medium mb-3 flex items-center gap-2">
              <History className="w-4 h-4 text-muted-foreground" />
              История смены статусов
            </h3>
            <div className="space-y-2">
              {tkp.status_history.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 text-sm py-1.5 border-b border-border last:border-0">
                  <span className="text-muted-foreground text-xs whitespace-nowrap">{formatDateTime(entry.changed_at)}</span>
                  <span className="text-muted-foreground">{entry.changed_by_name || '—'}</span>
                  <span className="text-muted-foreground">→</span>
                  <Badge className={getStatusBadgeClass(entry.new_status)}>{getStatusLabel(entry.new_status)}</Badge>
                  {entry.comment && <span className="text-muted-foreground italic text-xs">({entry.comment})</span>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* История версий */}
      {versions && versions.length > 0 && (
        <div className="bg-card rounded-lg shadow-sm border border-border p-6">
          <h2 className="text-foreground mb-4 flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-orange-600" />
            История версий ({versions.length})
          </h2>
          <div className="space-y-2">
            {versions.map((version) => (
              <div
                key={version.id}
                className={`p-3 rounded-lg border ${
                  version.id === tkp.id
                    ? "bg-primary/10 border-primary/20"
                    : "bg-muted border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-foreground">
                      Версия {version.version_number}
                      {version.is_latest_version && (
                        <Badge className="ml-2 bg-blue-100 dark:bg-blue-900/30 text-primary">Актуальная</Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground">{formatDate(version.date)}</div>
                  </div>
                  {version.id !== tkp.id && (
                    <Button
                      onClick={() =>
                        window.open(`/proposals/technical-proposals/${version.id}`, "_blank")
                      }
                      className="bg-muted text-foreground hover:bg-muted"
                    >
                      Открыть
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
