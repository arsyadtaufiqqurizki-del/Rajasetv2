import { UserCircle, Menu } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, Archive, Wrench, BarChart2, Settings, Plus, HelpCircle, LogOut, Database, Sparkles, BookOpen, ClipboardCheck } from "lucide-react";
import { cn } from "../lib/utils";
import { useAsset } from "../contexts/AssetContext";
import { useAuth } from "../contexts/AuthContext";
import AddAssetModal from "./AddAssetModal";
import NotificationBell from "./NotificationBell";
import EditAssetModal from "./EditAssetModal";
import AddReclassificationModal from "./AddReclassificationModal";
import EditReclassificationModal from "./EditReclassificationModal";
import VerifyReclassificationModal from "./VerifyReclassificationModal";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Asset Inventory", href: "/inventory", icon: Archive },
  { label: "Maintenance", href: "/maintenance", icon: Wrench },
  { label: "Reclassification", href: "/reclassification", icon: ClipboardCheck },
  { label: "Master Data", href: "/master-data", icon: Database },
  { label: "Reports", href: "/reports", icon: BarChart2 },
  { label: "AI Assistant", href: "/ai-assistant", icon: Sparkles },
  { label: "User Guide", href: "/guide", icon: BookOpen },
  { label: "Settings", href: "/settings", icon: Settings },
];

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { setIsAddModalOpen } = useAsset();
  const { logout, userEmail } = useAuth();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    }
    if (profileMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileMenuOpen]);

  return (
    <div className="flex min-h-screen w-full overflow-hidden bg-background">
      {/* Overlay for mobile sidebar */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-surface-container-lowest border-r border-outline-variant transition-transform duration-300 md:static md:translate-x-0 hidden md:flex",
        mobileMenuOpen ? "flex translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col gap-2 border-b border-outline-variant/30 p-6">
          <h1 className="text-xl font-bold text-primary tracking-tight">Perusahaan Raja</h1>
          <p className="text-xs font-medium text-on-surface-variant">Asset Management</p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto w-full p-2 py-4">
          <ul className="flex flex-col gap-1 w-full">
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;
              return (
                <li key={item.href} className="w-full">
                  <Link
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors w-full",
                      isActive
                        ? "bg-secondary-container text-on-secondary-container border-r-4 border-primary shadow-sm"
                        : "text-on-surface-variant hover:bg-surface-container-low"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-auto border-t border-outline-variant/30 p-4">
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Add New Asset
          </button>
          
          <ul className="mt-4 flex flex-col gap-1 w-full">
            <li>
              <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-on-surface-variant hover:bg-surface-container-low transition-colors">
                <HelpCircle className="h-4 w-4" />
                Help Center
              </button>
            </li>
            <li>
              <button 
                onClick={logout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-on-surface-variant hover:bg-surface-container-low transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </li>
          </ul>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden relative min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-30 flex min-h-16 h-16 w-full items-center justify-between border-b border-outline-variant bg-surface/80 px-4 backdrop-blur-md md:px-6 shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="text-on-surface-variant hover:text-primary md:hidden"
            >
              <Menu className="h-6 w-6" />
            </button>
            
            <h1 className="text-xl font-bold text-primary md:hidden">PR</h1>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setProfileMenuOpen((v) => !v)}
                className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition-colors"
              >
                <UserCircle className="h-6 w-6" />
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-outline-variant bg-surface shadow-xl z-50 overflow-hidden">
                  <div className="border-b border-outline-variant px-4 py-3">
                    <p className="truncate text-sm font-medium text-on-surface">{userEmail ?? "..."}</p>
                  </div>
                  <div className="flex flex-col py-1">
                    <Link
                      to="/settings"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-low transition-colors"
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                    <button
                      onClick={() => {
                        setProfileMenuOpen(false);
                        logout();
                      }}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-low transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-background">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>

      <AddAssetModal />
      <EditAssetModal />
      <AddReclassificationModal />
      <EditReclassificationModal />
      <VerifyReclassificationModal />
    </div>
  );
}
