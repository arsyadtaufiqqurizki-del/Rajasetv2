import { User, SlidersHorizontal, BellRing, Shield, Camera, Lock, Save, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { useState } from 'react';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Form States (Frontend Only)
  const [profile, setProfile] = useState({
    name: 'Admin User',
    email: 'admin@perusahaanraja.com'
  });

  const [config, setConfig] = useState({
    language: 'id',
    timezone: 'Asia/Jakarta',
    currency: 'IDR',
    rowsPerPage: '25'
  });

  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    lowStock: true,
    maintenance: true,
    systemUpdates: false
  });

  const [security, setSecurity] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    twoFactor: false
  });

  const handleSave = () => {
    setIsSaving(true);
    // Simulate network request
    setTimeout(() => {
      setIsSaving(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }, 800);
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
              Changes saved successfully
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Settings Navigation Sidebar */}
        <nav className="w-full lg:w-64 shrink-0 flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 scrollbar-hide bg-surface-container-lowest rounded-xl border border-outline-variant p-2 shadow-sm">
           <button 
             onClick={() => setActiveTab('profile')}
             className={cn("text-left px-4 py-3 rounded-lg flex items-center gap-3 font-medium transition-colors whitespace-nowrap",
               activeTab === 'profile' ? "bg-surface-container-low text-primary font-bold" : "text-on-surface-variant hover:bg-surface-container"
             )}>
              <User className={cn("h-5 w-5", activeTab === 'profile' && "fill-current")} /> User Profile
           </button>
           <button 
             onClick={() => setActiveTab('config')}
             className={cn("text-left px-4 py-3 rounded-lg flex items-center gap-3 font-medium transition-colors whitespace-nowrap",
               activeTab === 'config' ? "bg-surface-container-low text-primary font-bold" : "text-on-surface-variant hover:bg-surface-container"
             )}>
              <SlidersHorizontal className={cn("h-5 w-5", activeTab === 'config' && "fill-current")} /> System Configuration
           </button>
           <button 
             onClick={() => setActiveTab('notif')}
             className={cn("text-left px-4 py-3 rounded-lg flex items-center gap-3 font-medium transition-colors whitespace-nowrap",
               activeTab === 'notif' ? "bg-surface-container-low text-primary font-bold" : "text-on-surface-variant hover:bg-surface-container"
             )}>
              <BellRing className={cn("h-5 w-5", activeTab === 'notif' && "fill-current")} /> Notifications
           </button>
            <button 
             onClick={() => setActiveTab('security')}
             className={cn("text-left px-4 py-3 rounded-lg flex items-center gap-3 font-medium transition-colors whitespace-nowrap",
               activeTab === 'security' ? "bg-surface-container-low text-primary font-bold" : "text-on-surface-variant hover:bg-surface-container"
             )}>
              <Shield className={cn("h-5 w-5", activeTab === 'security' && "fill-current")} /> Security
           </button>
        </nav>

        {/* Content Area */}
        <div className="flex-1 w-full flex flex-col gap-6">
          
          {activeTab === 'profile' && (
            <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
              <div className="p-6 border-b border-outline-variant">
                <h3 className="text-xl font-bold text-on-surface">User Profile</h3>
                <p className="text-sm text-on-surface-variant mt-1">Update your personal information and profile photo.</p>
              </div>
              
              <div className="p-6 md:p-8">
                <div className="flex flex-col md:flex-row gap-10">
                  {/* Avatar Upload */}
                  <div className="flex flex-col items-center gap-4 shrink-0">
                    <div className="relative group cursor-pointer">
                      <div className="w-32 h-32 rounded-lg overflow-hidden border border-outline-variant bg-surface-container flex items-center justify-center">
                        <img 
                          src="https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop&q=80" 
                          alt="Admin Avatar" 
                          className="w-full h-full object-cover" 
                        />
                      </div>
                      <div className="absolute inset-0 bg-primary/70 text-on-primary flex flex-col items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="h-6 w-6 mb-2" />
                        <span className="text-sm font-semibold">Change</span>
                      </div>
                    </div>
                    <p className="text-xs font-mono text-on-surface-variant text-center max-w-[150px]">
                      JPG, GIF or PNG. Max size of 800K
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
                          onChange={(e) => setProfile({...profile, name: e.target.value})}
                          className="w-full px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow" 
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-on-surface">Email Address</label>
                        <input 
                          type="email" 
                          value={profile.email}
                          onChange={(e) => setProfile({...profile, email: e.target.value})}
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
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-6 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-bold shadow-sm hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-70">
                        {isSaving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Changes</>}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'config' && (
             <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden animate-in fade-in">
              <div className="p-6 border-b border-outline-variant">
                <h3 className="text-xl font-bold text-on-surface">System Configuration</h3>
                <p className="text-sm text-on-surface-variant mt-1">Configure global application settings and regional preferences.</p>
              </div>
              
              <div className="p-6 md:p-8 flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-on-surface">Language</label>
                    <select 
                      value={config.language}
                      onChange={(e) => setConfig({...config, language: e.target.value})}
                      className="w-full px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow appearance-none"
                    >
                      <option value="id">Bahasa Indonesia</option>
                      <option value="en">English (US)</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-on-surface">Timezone</label>
                    <select 
                      value={config.timezone}
                      onChange={(e) => setConfig({...config, timezone: e.target.value})}
                      className="w-full px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow appearance-none"
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
                      onChange={(e) => setConfig({...config, currency: e.target.value})}
                      className="w-full px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow appearance-none"
                    >
                      <option value="IDR">IDR - Indonesian Rupiah</option>
                      <option value="USD">USD - US Dollar</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-on-surface">Default Rows per Page</label>
                    <select 
                      value={config.rowsPerPage}
                      onChange={(e) => setConfig({...config, rowsPerPage: e.target.value})}
                      className="w-full px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow appearance-none"
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
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-bold shadow-sm hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-70">
                    {isSaving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Changes</>}
                  </button>
                </div>
              </div>
             </section>
          )}

          {activeTab === 'notif' && (
             <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden animate-in fade-in">
              <div className="p-6 border-b border-outline-variant">
                <h3 className="text-xl font-bold text-on-surface">Notification Alerts</h3>
                <p className="text-sm text-on-surface-variant mt-1">Choose what events you want to be notified about.</p>
              </div>
              
              <div className="p-6 md:p-8 flex flex-col gap-6">
                
                <div className="space-y-4">
                  {[
                    { key: 'emailAlerts', title: 'Email Summaries', desc: 'Receive daily summary emails about inventory status.' },
                    { key: 'lowStock', title: 'Low Stock Warnings', desc: 'Get notified immediately when an item falls below minimum threshold.' },
                    { key: 'maintenance', title: 'Maintenance Reminders', desc: 'Alerts for upcoming scheduled maintenance tasks.' },
                    { key: 'systemUpdates', title: 'System Updates', desc: 'Notifications about new features and system maintenance.' },
                  ].map((item) => (
                    <label key={item.key} className="flex items-start gap-4 p-4 rounded-lg border border-outline-variant hover:bg-surface-container-low cursor-pointer transition-colors">
                      <div className="mt-0.5">
                        <input 
                          type="checkbox" 
                          checked={notifications[item.key as keyof typeof notifications]}
                          onChange={(e) => setNotifications({...notifications, [item.key]: e.target.checked})}
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
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-bold shadow-sm hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-70">
                    {isSaving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Changes</>}
                  </button>
                </div>
              </div>
             </section>
          )}

          {activeTab === 'security' && (
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
                      onChange={(e) => setSecurity({...security, currentPassword: e.target.value})}
                      className="w-full px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow" 
                    />
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-on-surface">New Password</label>
                    <input 
                      type="password" 
                      value={security.newPassword}
                      onChange={(e) => setSecurity({...security, newPassword: e.target.value})}
                      className="w-full px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow" 
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-on-surface">Confirm New Password</label>
                    <input 
                      type="password" 
                      value={security.confirmPassword}
                      onChange={(e) => setSecurity({...security, confirmPassword: e.target.value})}
                      className="w-full px-4 py-2.5 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-shadow" 
                    />
                  </div>
                </div>

                <div className="pt-6 border-t border-outline-variant max-w-md">
                  <label className="flex items-start gap-4 p-4 rounded-lg bg-surface-container-low border border-outline-variant cursor-pointer transition-colors">
                    <div className="mt-0.5">
                      <input 
                        type="checkbox" 
                        checked={security.twoFactor}
                        onChange={(e) => setSecurity({...security, twoFactor: e.target.checked})}
                        className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary accent-primary" 
                      />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-on-surface">Two-Factor Authentication</h4>
                      <p className="text-sm text-on-surface-variant mt-1">Add an extra layer of security to your account by requiring a verification code upon login.</p>
                    </div>
                  </label>
                </div>

                <div className="pt-6 flex justify-start border-t border-outline-variant mt-2">
                  <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-bold shadow-sm hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-70">
                    {isSaving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Changes</>}
                  </button>
                </div>
              </div>
             </section>
          )}

        </div>
      </div>
    </div>
  );
}
