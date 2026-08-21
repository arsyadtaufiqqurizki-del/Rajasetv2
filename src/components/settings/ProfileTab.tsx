import { Camera, Lock, Save } from 'lucide-react';

export interface ProfileFormState {
  name: string;
  email: string;
}

interface ProfileTabProps {
  profile: ProfileFormState;
  onProfileChange: (profile: ProfileFormState) => void;
  isSaving: boolean;
  onSave: () => void;
}

export default function ProfileTab({ profile, onProfileChange, isSaving, onSave }: ProfileTabProps) {
  return (
    <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
      <div className="p-6 border-b border-outline-variant">
        <h3 className="text-xl font-bold text-on-surface">User Profile</h3>
        <p className="text-sm text-on-surface-variant mt-1">Update your personal information and profile photo.</p>
      </div>

      <div className="p-6 md:p-8">
        <div className="flex flex-col md:flex-row gap-10">
          {/* Avatar Upload — not yet wired to a real upload flow, see refactoring_plan.md Step 10 */}
          <div className="flex flex-col items-center gap-4 shrink-0">
            <div className="relative group cursor-not-allowed">
              <div className="w-32 h-32 rounded-lg overflow-hidden border border-outline-variant bg-surface-container flex items-center justify-center">
                <img
                  src="https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop&q=80"
                  alt="Admin Avatar"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute inset-0 bg-primary/70 text-on-primary flex flex-col items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-6 w-6 mb-2" />
                <span className="text-sm font-semibold">Coming soon</span>
              </div>
            </div>
            <p className="text-xs font-mono text-on-surface-variant text-center max-w-[150px]">
              Photo upload isn't available yet
            </p>
          </div>

          {/* Form */}
          <div className="flex-1 flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-on-surface">Full Name</label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => onProfileChange({ ...profile, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-on-surface">Email Address</label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => onProfileChange({ ...profile, email: e.target.value })}
                  className="w-full px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-on-surface">System Role</label>
              <div className="px-4 py-2.5 bg-surface-container border border-outline-variant rounded-lg text-sm text-on-surface-variant flex items-center justify-between cursor-not-allowed">
                <span>System Administrator</span>
                <Lock className="h-4 w-4" />
              </div>
              <p className="text-xs font-mono text-on-surface-variant mt-1.5">Role assignments can only be modified by Super Admins.</p>
            </div>

            <div className="pt-6 flex justify-end">
              <button
                onClick={onSave}
                disabled={isSaving}
                className="px-6 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-bold shadow-sm hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-70">
                {isSaving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Changes</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
