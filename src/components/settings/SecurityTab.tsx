import { Save } from 'lucide-react';

export interface SecurityFormState {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  twoFactor: boolean;
}

interface SecurityTabProps {
  security: SecurityFormState;
  onSecurityChange: (security: SecurityFormState) => void;
  isSaving: boolean;
  onSave: () => void;
}

export default function SecurityTab({ security, onSecurityChange, isSaving, onSave }: SecurityTabProps) {
  return (
    <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden animate-in fade-in">
      <div className="p-6 border-b border-outline-variant">
        <h3 className="text-xl font-bold text-on-surface">Security Settings</h3>
        <p className="text-sm text-on-surface-variant mt-1">Manage your password and security preferences.</p>
      </div>

      <div className="p-6 md:p-8 flex flex-col gap-8">

        <div className="flex flex-col gap-4 max-w-md">
          <h4 className="text-sm font-bold text-on-surface mb-2">Change Password</h4>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-on-surface">Current Password</label>
            <input
              type="password"
              value={security.currentPassword}
              onChange={(e) => onSecurityChange({ ...security, currentPassword: e.target.value })}
              className="w-full px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-on-surface">New Password</label>
            <input
              type="password"
              value={security.newPassword}
              onChange={(e) => onSecurityChange({ ...security, newPassword: e.target.value })}
              className="w-full px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-on-surface">Confirm New Password</label>
            <input
              type="password"
              value={security.confirmPassword}
              onChange={(e) => onSecurityChange({ ...security, confirmPassword: e.target.value })}
              className="w-full px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
            />
          </div>
        </div>

        <div className="pt-6 border-t border-outline-variant max-w-md">
          <label className="flex items-start gap-4 p-4 rounded-lg bg-surface-container-low border border-outline-variant opacity-60 cursor-not-allowed transition-colors">
            <div className="mt-0.5">
              <input
                type="checkbox"
                checked={security.twoFactor}
                disabled
                className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary accent-primary"
              />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-on-surface flex items-center gap-2">
                Two-Factor Authentication
                <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">Coming soon</span>
              </h4>
              <p className="text-sm text-on-surface-variant mt-1">Add an extra layer of security to your account by requiring a verification code upon login.</p>
            </div>
          </label>
        </div>

        <div className="pt-6 flex justify-start border-t border-outline-variant mt-2">
          <button
            onClick={onSave}
            disabled={isSaving}
            className="px-6 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-bold shadow-sm hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-70">
            {isSaving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Changes</>}
          </button>
        </div>
      </div>
    </section>
  );
}
