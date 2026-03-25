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
  extraColor = 'text-muted-foreground',
}: SummaryCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <div className="text-2xl font-bold text-foreground">{value}</div>
          <div className="text-sm text-muted-foreground">{label}</div>
          {extra && <div className={cn('text-xs mt-0.5', extraColor)}>{extra}</div>}
        </div>
      </div>
    </div>
  );
}
