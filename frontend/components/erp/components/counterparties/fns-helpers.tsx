import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, FNSSuggestResult, FNSQuickCheckResponse } from '@/lib/api';
import { Loader2, Database, Globe, ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';

// ─── Debounce hook ────────────────────────────────────────────────

export const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

// ─── FNS Suggest Dropdown ─────────────────────────────────────────

interface FNSSuggestDropdownProps {
  query: string;
  onSelect: (result: FNSSuggestResult) => void;
  isVisible: boolean;
  onClose: () => void;
}

export function FNSSuggestDropdown({ query, onSelect, isVisible, onClose }: FNSSuggestDropdownProps) {
  const debouncedQuery = useDebounce(query, 400);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['fns-suggest', debouncedQuery],
    queryFn: () => api.core.fnsSuggest(debouncedQuery),
    enabled: isVisible && debouncedQuery.length >= 3,
    staleTime: 60_000,
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isVisible, onClose]);

  if (!isVisible || debouncedQuery.length < 3) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto"
    >
      {isLoading ? (
        <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500">
          <Loader2 className="w-3 h-3 animate-spin" />
          Поиск...
        </div>
      ) : data?.results && data.results.length > 0 ? (
        <>
          <div className="px-3 py-1.5 text-xs text-gray-400 border-b bg-gray-50 flex items-center gap-1">
            {data.source === 'local' ? (
              <><Database className="w-3 h-3" /> Из нашей базы</>
            ) : (
              <><Globe className="w-3 h-3" /> Из ФНС</>
            )}
            <span className="ml-auto">{data.total} результат(ов)</span>
          </div>
          {data.results.map((result, idx) => (
            <button
              key={`${result.inn}-${idx}`}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-b last:border-b-0"
              onClick={() => { onSelect(result); onClose(); }}
            >
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{result.name}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-2">
                    <span className="font-mono">ИНН: {result.inn}</span>
                    {result.kpp && <span className="font-mono">КПП: {result.kpp}</span>}
                  </div>
                  {result.address && (
                    <div className="text-xs text-gray-400 truncate">{result.address}</div>
                  )}
                </div>
                {result.is_local && (
                  <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 rounded">
                    В базе
                  </span>
                )}
              </div>
            </button>
          ))}
        </>
      ) : debouncedQuery.length >= 3 ? (
        <div className="px-3 py-2 text-sm text-gray-500">Ничего не найдено</div>
      ) : null}
    </div>
  );
}

// ─── FNS Check Tab Content ────────────────────────────────────────

export function FNSCheckTabContent({ data }: { data: FNSQuickCheckResponse }) {
  const { summary } = data;

  const RiskIcon = summary.risk_level === 'low' ? ShieldCheck
    : summary.risk_level === 'medium' ? ShieldAlert
    : summary.risk_level === 'high' ? ShieldX
    : AlertTriangle;

  const riskColor = summary.risk_level === 'low' ? 'text-green-600 bg-green-50 border-green-200'
    : summary.risk_level === 'medium' ? 'text-yellow-600 bg-yellow-50 border-yellow-200'
    : summary.risk_level === 'high' ? 'text-red-600 bg-red-50 border-red-200'
    : 'text-gray-600 bg-gray-50 border-gray-200';

  const riskLabel = summary.risk_level === 'low' ? 'Низкий риск'
    : summary.risk_level === 'medium' ? 'Средний риск'
    : summary.risk_level === 'high' ? 'Высокий риск'
    : 'Нет данных';

  return (
    <div className="space-y-4">
      <div className={`p-3 rounded-lg border ${riskColor}`}>
        <div className="flex items-center gap-2">
          <RiskIcon className="w-5 h-5" />
          <span className="text-sm font-semibold">{riskLabel}</span>
          <span className="text-xs ml-auto font-mono">
            +{summary.positive_count} / -{summary.negative_count}
          </span>
        </div>
      </div>

      {summary.negative.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5" />
            Негативные факторы ({summary.negative.length})
          </h4>
          <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
            {summary.negative.map((item, i) => (
              <div key={i} className="flex items-start gap-2 p-2 bg-red-50 rounded text-xs text-red-800 border border-red-100">
                <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.positive.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Позитивные факторы ({summary.positive.length})
          </h4>
          <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
            {summary.positive.map((item, i) => (
              <div key={i} className="flex items-start gap-2 p-2 bg-green-50 rounded text-xs text-green-800 border border-green-100">
                <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.positive.length === 0 && summary.negative.length === 0 && (
        <div className="text-center py-6 text-gray-400 text-sm">
          Факторы не обнаружены
        </div>
      )}
    </div>
  );
}
