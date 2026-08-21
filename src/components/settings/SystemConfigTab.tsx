import { useState } from 'react';

const ComingSoonBadge = () => (
  <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">Coming soon</span>
);

/**
 * Not persisted anywhere yet — no `user_preferences` table exists (see refactoring_plan.md
 * section 7, "Explicitly out of scope"). Fields are local-only and disabled rather than faking
 * a successful save, per the Step 10 decision to stop the System Config tab from lying.
 */
export default function SystemConfigTab() {
  const [config] = useState({
    language: 'id',
    timezone: 'Asia/Jakarta',
    currency: 'IDR',
    rowsPerPage: '25',
  });

  return (
    <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden animate-in fade-in">
      <div className="p-6 border-b border-outline-variant">
        <div className="flex items-center gap-2">
          <h3 className="text-xl font-bold text-on-surface">System Configuration</h3>
          <ComingSoonBadge />
        </div>
        <p className="text-sm text-on-surface-variant mt-1">Configure global application settings and regional preferences.</p>
      </div>

      <div className="p-6 md:p-8 flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-60">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-on-surface">Language</label>
            <select
              value={config.language}
              disabled
              className="w-full px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface outline-none appearance-none cursor-not-allowed"
            >
              <option value="id">Bahasa Indonesia</option>
              <option value="en">English (US)</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-on-surface">Timezone</label>
            <select
              value={config.timezone}
              disabled
              className="w-full px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface outline-none appearance-none cursor-not-allowed"
            >
              <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
              <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
              <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-on-surface">Default Currency</label>
            <select
              value={config.currency}
              disabled
              className="w-full px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface outline-none appearance-none cursor-not-allowed"
            >
              <option value="IDR">IDR - Indonesian Rupiah</option>
              <option value="USD">USD - US Dollar</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-on-surface">Default Rows per Page</label>
            <select
              value={config.rowsPerPage}
              disabled
              className="w-full px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface outline-none appearance-none cursor-not-allowed"
            >
              <option value="10">10 Rows</option>
              <option value="25">25 Rows</option>
              <option value="50">50 Rows</option>
              <option value="100">100 Rows</option>
            </select>
          </div>
        </div>

        <div className="pt-6 flex justify-end border-t border-outline-variant">
          <button
            disabled
            title="System configuration persistence is coming soon"
            className="px-6 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-bold shadow-sm opacity-50 cursor-not-allowed">
            Coming soon
          </button>
        </div>
      </div>
    </section>
  );
}
