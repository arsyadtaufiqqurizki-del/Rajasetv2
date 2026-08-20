import { CheckCircle } from 'lucide-react';

interface ToastProps {
  message: string | null;
  icon?: React.ReactNode;
}

export default function Toast({ message, icon }: ToastProps) {
  if (!message) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-surface border border-outline-variant rounded-md shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
      {icon ?? <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />}
      <span className="text-sm text-on-surface">{message}</span>
    </div>
  );
}
