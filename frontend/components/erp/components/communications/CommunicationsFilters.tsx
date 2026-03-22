import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, Search } from 'lucide-react';
import { unwrapResults } from '@/lib/api';

type Filters = {
  contract: string;
  type: string;
  category: string;
  status: string;
};

type CommunicationsFiltersProps = {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  contracts: { id: number; number: string; name?: string }[];
};

export function CommunicationsFilters({
  filters,
  onFiltersChange,
  searchQuery,
  onSearchQueryChange,
  contracts,
}: CommunicationsFiltersProps) {
  const hasActiveFilters = filters.contract || filters.type || filters.category || filters.status || searchQuery;

  return (
    <Card className="p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-5 h-5 text-gray-500" />
        <h3 className="text-sm">Фильтры</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div>
          <Label className="text-xs text-gray-600">Договор</Label>
          <Select
            value={filters.contract}
            onValueChange={(value) => onFiltersChange({ ...filters, contract: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Все" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              {(unwrapResults(contracts)).map((contract: { id: number; number: string }) => (
                <SelectItem key={contract.id} value={contract.id.toString()}>
                  {contract.number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs text-gray-600">Тип</Label>
          <Select
            value={filters.type}
            onValueChange={(value) => onFiltersChange({ ...filters, type: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Все" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              <SelectItem value="incoming">Входящее</SelectItem>
              <SelectItem value="outgoing">Исходящее</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs text-gray-600">Категория</Label>
          <Select
            value={filters.category}
            onValueChange={(value) => onFiltersChange({ ...filters, category: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Все" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              <SelectItem value="уведомление">Уведомление</SelectItem>
              <SelectItem value="претензия">Претензия</SelectItem>
              <SelectItem value="запрос">Запрос</SelectItem>
              <SelectItem value="ответ">Ответ</SelectItem>
              <SelectItem value="прочее">Прочее</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs text-gray-600">Статус</Label>
          <Select
            value={filters.status}
            onValueChange={(value) => onFiltersChange({ ...filters, status: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Все" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              <SelectItem value="новое">Новое</SelectItem>
              <SelectItem value="в работе">В работе</SelectItem>
              <SelectItem value="отвечено">Отвечено</SelectItem>
              <SelectItem value="закрыто">Закрыто</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs text-gray-600">Поиск</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Поиск..."
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onFiltersChange({ contract: '', type: '', category: '', status: '' });
              onSearchQueryChange('');
            }}
          >
            Сбросить фильтры
          </Button>
        </div>
      )}
    </Card>
  );
}
