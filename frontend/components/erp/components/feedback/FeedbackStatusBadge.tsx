'use client';

import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { FeedbackStatus } from '@/lib/api/types';

const STATUS_CONFIG: Record<FeedbackStatus, { label: string; className: string }> = {
  new: {
    label: 'Новый',
    className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 border-primary/20 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  },
  in_progress: {
    label: 'В работе',
    className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800',
  },
  resolved: {
    label: 'Решён',
    className: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  },
};

interface FeedbackStatusBadgeProps {
  status: FeedbackStatus;
  isStaff?: boolean;
  onStatusChange?: (status: FeedbackStatus) => void;
}

export function FeedbackStatusBadge({ status, isStaff, onStatusChange }: FeedbackStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const badge = <Badge className={config.className}>{config.label}</Badge>;

  if (!isStaff || !onStatusChange) {
    return badge;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="cursor-pointer">
          {badge}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {(Object.keys(STATUS_CONFIG) as FeedbackStatus[])
          .filter(s => s !== status)
          .map(s => (
            <DropdownMenuItem key={s} onClick={() => onStatusChange(s)}>
              <Badge className={STATUS_CONFIG[s].className}>{STATUS_CONFIG[s].label}</Badge>
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
