import { Check, Clock, AlertCircle, PackageX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export type StatusType = 'available' | 'reserved' | 'order-required' | 'completed' | 'postponed' | 'active' | 'overdue';

interface StatusPillProps {
  status: StatusType;
  label?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

const statusConfig: Record<StatusType, { 
  label: string; 
  className: string; 
  icon?: React.ElementType;
}> = {
  'available': {
    label: 'Available',
    className: 'bg-[hsl(var(--status-available))] text-[hsl(var(--status-available-foreground))] hover:bg-[hsl(var(--status-available))]',
    icon: Check
  },
  'reserved': {
    label: 'Reserved',
    className: 'bg-[hsl(var(--status-reserved))] text-[hsl(var(--status-reserved-foreground))] hover:bg-[hsl(var(--status-reserved))]',
    icon: Clock
  },
  'order-required': {
    label: 'Order Required',
    className: 'bg-[hsl(var(--status-order-required))] text-[hsl(var(--status-order-required-foreground))] hover:bg-[hsl(var(--status-order-required))]',
    icon: AlertCircle
  },
  'completed': {
    label: 'Completed',
    className: 'bg-[hsl(var(--status-available))] text-[hsl(var(--status-available-foreground))] hover:bg-[hsl(var(--status-available))]',
    icon: Check
  },
  'postponed': {
    label: 'Postponed',
    className: 'bg-[hsl(var(--status-reserved))] text-[hsl(var(--status-reserved-foreground))] hover:bg-[hsl(var(--status-reserved))]',
    icon: Clock
  },
  'active': {
    label: 'Active',
    className: 'bg-blue-500 text-white hover:bg-blue-500',
    icon: Clock
  },
  'overdue': {
    label: 'Overdue',
    className: 'bg-[hsl(var(--status-order-required))] text-[hsl(var(--status-order-required-foreground))] hover:bg-[hsl(var(--status-order-required))]',
    icon: AlertCircle
  }
};

export function StatusPill({ status, label, showIcon = true, size = 'sm' }: StatusPillProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const displayLabel = label || config.label;

  return (
    <Badge 
      variant="default"
      className={`${config.className} ${size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'} font-medium inline-flex items-center gap-1`}
      data-testid={`status-pill-${status}`}
    >
      {showIcon && Icon && <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />}
      {displayLabel}
    </Badge>
  );
}
