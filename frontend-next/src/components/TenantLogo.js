'use client';

import React from 'react';
import { useTenantTheme } from '@/contexts/TenantThemeContext';
import { TENANT_THEMES } from '@/config/tenantThemes';
import QuadleyLogo from '@/components/QuadleyLogo';

const TenantLogo = ({ size = 48, className = '' }) => {
  const { tenantCode, branding } = useTenantTheme();

  const logoUrl = branding?.logo_url
    || (tenantCode && TENANT_THEMES[tenantCode?.toUpperCase()]?.logoPath)
    || null;

  if (!logoUrl) {
    return <QuadleyLogo size={size} className={className} />;
  }

  const tenantName = branding?.college_name
    || TENANT_THEMES[tenantCode?.toUpperCase()]?.name
    || 'College';

  return (
    <img
      src={logoUrl}
      alt={`${tenantName} logo`}
      style={{ width: size, height: size, objectFit: 'contain' }}
      className={className}
      onError={(e) => { e.target.style.display = 'none'; }}
    />
  );
};

export default TenantLogo;
