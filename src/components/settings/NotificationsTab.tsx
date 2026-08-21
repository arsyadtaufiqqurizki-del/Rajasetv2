import { useState } from 'react';

const ComingSoonBadge = () => (
  <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">Coming soon</span>
);

const NOTIFICATION_ITEMS = [
  { key: 'emailAlerts', title: 'Email Summaries', desc: 'Receive daily summary emails about inventory status.' },
  { key: 'lowStock', title: 'Low Stock Warnings', desc: 'Get notified immediately when an item falls below minimum threshold.' },
  { key: 'maintenance', title: 'Maintenance Reminders', desc: 'Alerts for upcoming scheduled maintenance tasks.' },
  { key: 'systemUpdates', title: 'System Updates', desc: 'Notifications about new features and system maintenance.' },
] as const;

/**
 * Not persisted anywhere yet — same "Coming soon" decision as SystemConfigTab, see
 * refactoring_plan.md Step 10.
 */
export default function NotificationsTab() {
  const [notifications] = useState({
    emailAlerts: true,
    lowStock: true,
    maintenance: true,
    systemUpdates: false,
  });

  return (
    <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden animate-in fade-in">
      <div className="p-6 border-b border-outline-variant">
        <div className="flex items-center gap-2">
          <h3 className="text-xl font-bold text-on-surface">Notification Alerts</h3>
          <ComingSoonBadge />
        </div>
        <p className="text-sm text-on-surface-variant mt-1">Choose what events you want to be notified about.</p>
      </div>

      <div className="p-6 md:p-8 flex flex-col gap-6">

        <div className="space-y-4 opacity-60">
          {NOTIFICATION_ITEMS.map((item) => (
            <label key={item.key} className="flex items-start gap-4 p-4 rounded-lg border border-outline-variant cursor-not-allowed transition-colors">
              <div className="mt-0.5">
                <input
                  type="checkbox"
                  checked={notifications[item.key]}
                  disabled
                  className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary accent-primary"
                />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-on-surface">{item.title}</h4>
                <p className="text-sm text-on-surface-variant mt-1">{item.desc}</p>
              </div>
            </label>
          ))}
        </div>

        <div className="pt-6 flex justify-end border-t border-outline-variant mt-2">
          <button
            disabled
            title="Notification persistence is coming soon"
            className="px-6 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-bold shadow-sm opacity-50 cursor-not-allowed">
            Coming soon
          </button>
        </div>
      </div>
    </section>
  );
}
