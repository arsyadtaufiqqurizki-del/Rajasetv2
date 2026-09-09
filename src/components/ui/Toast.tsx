import { CheckCircle, X } from 'lucide-react';

interface ToastProps {
  message: string | null;
  icon?: React.ReactNode;
  onClose: () => void;
}

export default function Toast({ message, icon, onClose }: ToastProps) {
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-surface border border-outline-variant rounded-md shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      {icon ?? <CheckCircle className="h-4 w-4 text-success shrink-0" />}
      <span className="text-sm text-on-surface">{message}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss notification"
        className="p-0.5 rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
