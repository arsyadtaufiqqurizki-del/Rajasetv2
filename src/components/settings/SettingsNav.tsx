import { User, SlidersHorizontal, BellRing, Shield } from 'lucide-react';
import { cn } from '../../lib/utils';

export type SettingsTab = 'profile' | 'config' | 'notif' | 'security';

interface SettingsNavProps {
  activeTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

const TABS: { key: SettingsTab; label: string; icon: typeof User }[] = [
  { key: 'profile', label: 'User Profile', icon: User },
  { key: 'config', label: 'System Configuration', icon: SlidersHorizontal },
  { key: 'notif', label: 'Notifications', icon: BellRing },
  { key: 'security', label: 'Security', icon: Shield },
];

export default function SettingsNav({ activeTab, onTabChange }: SettingsNavProps) {
  return (
    <nav className="w-full lg:w-64 shrink-0 flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 scrollbar-hide bg-surface-container-lowest rounded-xl border border-outline-variant p-2 shadow-sm">
      {TABS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => onTabChange(key)}
          className={cn(
            'text-left px-4 py-3 rounded-lg flex items-center gap-3 font-medium transition-colors whitespace-nowrap',
            activeTab === key ? 'bg-surface-container-low text-primary font-bold' : 'text-on-surface-variant hover:bg-surface-container'
          )}
        >
          <Icon className={cn('h-5 w-5', activeTab === key && 'fill-current')} /> {label}
        </button>
      ))}
    </nav>
  );
}
