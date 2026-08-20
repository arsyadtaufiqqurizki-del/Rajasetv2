import { cn } from '../../lib/utils';

interface EmptyStateProps {
  message: string;
  icon?: React.ReactNode;
  className?: string;
}

export default function EmptyState({ message, icon, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 py-8 text-center text-on-surface-variant', className)}>
      {icon}
      <span>{message}</span>
    </div>
  );
}

interface TableEmptyRowProps {
  colSpan: number;
  message: string;
}

/** Same visual as EmptyState, shaped as a <tr> for use inside a table's <tbody>. */
export function TableEmptyRow({ colSpan, message }: TableEmptyRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-8 text-center text-on-surface-variant">
        {message}
      </td>
    </tr>
  );
}
