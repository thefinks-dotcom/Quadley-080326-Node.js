'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import TenantLogo from '@/components/TenantLogo';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900">
      <div className="text-center space-y-6 animate-fade-in">
        <div className="flex justify-center">
          <div className="p-4 bg-white/10 rounded-2xl">
            <TenantLogo size={80} />
          </div>
        </div>
        <div>
          <h1 className="font-heading text-3xl font-bold text-white tracking-tight mb-2">Quadley</h1>
          <p className="text-slate-400 text-sm">Loading your campus community...</p>
        </div>
        <div className="flex items-center justify-center gap-1.5">
          <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}
