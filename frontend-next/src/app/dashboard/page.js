'use client';

import { useContext, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import HomeModule from '@/components/modules/HomeModule';
import { AuthContext } from '@/contexts/AuthContext';

export default function DashboardHomePage() {
  const { user, loading } = useContext(AuthContext);
  const router = useRouter();

  useEffect(() => {
    if (!loading && user?.role === 'super_admin') {
      router.replace('/admin');
    }
  }, [user, loading, router]);

  if (loading || user?.role === 'super_admin') return null;

  return <HomeModule />;
}
