'use client';

import { Suspense, useContext, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import HomeModule from '@/components/modules/HomeModule';
import { AuthContext } from '@/contexts/AuthContext';

function DashboardContent() {
  const { user, loading } = useContext(AuthContext);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPreview = searchParams.get('preview') === '1';

  useEffect(() => {
    if (!loading && user?.role === 'super_admin' && !isPreview) {
      router.replace('/admin');
    }
  }, [user, loading, router, isPreview]);

  if (loading || (user?.role === 'super_admin' && !isPreview)) return null;

  return <HomeModule />;
}

export default function DashboardHomePage() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  );
}
