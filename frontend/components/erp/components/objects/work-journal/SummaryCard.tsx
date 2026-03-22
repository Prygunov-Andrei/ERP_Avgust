import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';

interface SummaryCardProps {
  icon: typeof Clock;
  label: string;
  value: number;
  extra?: string;
  extraColor?: string;
}

export function SummaryCard({
  icon: Icon,
  label,
  value,
  extra,
  extraColor = 'text-gray-500',
}: SummaryCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-50 rounded-lg">
          <Icon className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-900">{value}</div>
          <div className="text-sm text-gray-500">{label}</div>
          {extra && <div className={cn('text-xs mt-0.5', extraColor)}>{extra}</div>}
        </div>
      </div>
    </div>
  );
}
