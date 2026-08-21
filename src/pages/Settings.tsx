import { useState, useEffect } from 'react';
import { Check, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import SettingsNav, { type SettingsTab } from '../components/settings/SettingsNav';
import ProfileTab, { type ProfileFormState } from '../components/settings/ProfileTab';
import SecurityTab, { type SecurityFormState } from '../components/settings/SecurityTab';
import SystemConfigTab from '../components/settings/SystemConfigTab';
import NotificationsTab from '../components/settings/NotificationsTab';

export default function Settings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('Changes saved successfully');
  const [saveError, setSaveError] = useState<string | null>(null);

  const [profile, setProfile] = useState<ProfileFormState>({ name: '', email: '' });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setProfile({
          name: (data.user.user_metadata?.name as string | undefined) || '',
          email: data.user.email || '',
        });
      }
    });
  }, []);

  const [security, setSecurity] = useState<SecurityFormState>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    twoFactor: false,
  });

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    setSaveError(null);
  };

  const handleSaveProfile = async () => {
    setSaveError(null);
    if (!profile.name.trim() || !profile.email.trim()) {
      setSaveError('Name and email cannot be empty.');
      return;
    }

    setIsSaving(true);
    try {
      const { data: userData, error: getUserError } = await supabase.auth.getUser();
      if (getUserError || !userData.user) {
        throw new Error('Unable to verify current session.');
      }

      const currentName = (userData.user.user_metadata?.name as string | undefined) || '';
      const emailChanged = profile.email !== userData.user.email;
      const nameChanged = profile.name !== currentName;

      if (emailChanged || nameChanged) {
        const updates: { email?: string; data?: { name: string } } = {};
        if (emailChanged) updates.email = profile.email;
        if (nameChanged) updates.data = { name: profile.name };

        const { error: updateError } = await supabase.auth.updateUser(updates);
        if (updateError) throw updateError;
      }

      setIsSaving(false);
      setSuccessMessage(
        emailChanged
          ? 'Profile updated. Check your inbox to confirm the new email address.'
          : 'Changes saved successfully'
      );
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      setIsSaving(false);
      setSaveError(err instanceof Error ? err.message : 'Failed to update profile.');
    }
  };

  const handleSaveSecurity = async () => {
    setSaveError(null);
    if (!security.currentPassword || !security.newPassword || !security.confirmPassword) {
      setSaveError('Please fill in all password fields.');
      return;
    }
    if (security.newPassword !== security.confirmPassword) {
      setSaveError('New password and confirmation do not match.');
      return;
    }
    if (security.newPassword.length < 6) {
      setSaveError('New password must be at least 6 characters.');
      return;
    }

    setIsSaving(true);
    try {
      const { data: userData, error: getUserError } = await supabase.auth.getUser();
      if (getUserError || !userData.user?.email) {
        throw new Error('Unable to verify current session.');
      }

      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: userData.user.email,
        password: security.currentPassword,
      });
      if (reauthError) {
        throw new Error('Current password is incorrect.');
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: security.newPassword,
      });
      if (updateError) throw updateError;

      setSecurity({ currentPassword: '', newPassword: '', confirmPassword: '', twoFactor: security.twoFactor });
      setIsSaving(false);
      setSuccessMessage('Changes saved successfully');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      setIsSaving(false);
      setSaveError(err instanceof Error ? err.message : 'Failed to update password.');
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-6xl mx-auto">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-on-surface mb-2">Account Settings</h1>
          <p className="text-base text-on-surface-variant max-w-2xl">Manage your profile, system preferences, notification alerts, and security protocols.</p>
        </div>

        {/* Global Save Indicator */}
        <div className="hidden sm:block h-10">
          {showSuccess && (
            <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg text-sm font-bold animate-in fade-in slide-in-from-top-2">
              <Check className="h-4 w-4" />
              {successMessage}
            </div>
          )}
          {saveError && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-800 rounded-lg text-sm font-bold animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="h-4 w-4" />
              {saveError}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <SettingsNav activeTab={activeTab} onTabChange={handleTabChange} />

        <div className="flex-1 w-full flex flex-col gap-6">
          {activeTab === 'profile' && (
            <ProfileTab profile={profile} onProfileChange={setProfile} isSaving={isSaving} onSave={handleSaveProfile} />
          )}
          {activeTab === 'config' && <SystemConfigTab />}
          {activeTab === 'notif' && <NotificationsTab />}
          {activeTab === 'security' && (
            <SecurityTab security={security} onSecurityChange={setSecurity} isSaving={isSaving} onSave={handleSaveSecurity} />
          )}
        </div>
      </div>
    </div>
  );
}
