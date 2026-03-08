'use client';

import { useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AuthContext } from '@/contexts/AuthContext';
import OnboardingModal from '@/components/OnboardingModal';
import { LayoutGrid, MessageCircle, User, Shield } from 'lucide-react';

const STUDENT_TABS = [
  { id: 'home', label: 'Dashboard', icon: LayoutGrid, path: '/dashboard' },
  { id: 'messages', label: 'Messages', icon: MessageCircle, path: '/dashboard/messages' },
  { id: 'profile', label: 'Profile', icon: User, path: '/dashboard/profile' },
];

const ADMIN_TABS = [
  { id: 'home', label: 'Dashboard', icon: LayoutGrid, path: '/dashboard' },
  { id: 'messages', label: 'Messages', icon: MessageCircle, path: '/dashboard/messages' },
  { id: 'admin', label: 'Admin', icon: Shield, path: '/admin', external: true },
  { id: 'profile', label: 'Profile', icon: User, path: '/dashboard/profile' },
];

const ADMIN_ROLES = ['admin', 'super_admin', 'college_admin', 'ra'];

export default function DashboardLayout({ children }) {
  const { user, loading } = useContext(AuthContext);
  const router = useRouter();
  const pathname = usePathname();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && !user.onboarding_completed) {
      setShowOnboarding(true);
    }
  }, [user]);

  if (loading || !user) return null;

  const tabs = ADMIN_ROLES.includes(user.role) ? ADMIN_TABS : STUDENT_TABS;

  const isTabActive = (tab) => {
    if (tab.external) return false;
    if (tab.path === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(tab.path);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {showOnboarding && (
        <OnboardingModal onComplete={() => setShowOnboarding(false)} />
      )}

      <main className="flex-1 overflow-y-auto" style={{ paddingBottom: 'var(--bottom-nav-height)' }}>
        {children}
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-border z-50 flex items-center justify-around"
        style={{ height: 'var(--bottom-nav-height)' }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isTabActive(tab);
          return (
            <button
              key={tab.id}
              data-testid={`bottom-nav-${tab.id}`}
              onClick={() => router.push(tab.path)}
              className="flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors"
            >
              <Icon
                className="h-5 w-5"
                strokeWidth={active ? 2.5 : 1.5}
                style={{ color: active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}
              />
              <span
                className="text-xs font-medium"
                style={{
                  color: active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                  fontWeight: active ? 700 : 500,
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
