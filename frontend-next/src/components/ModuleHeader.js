'use client';

/**
 * ModuleHeader — example of a theme-aware component.
 *
 * Colors (bg-primary, text-white, etc.) come from CSS custom properties
 * that TenantThemeContext injects onto :root at runtime. No hex values
 * are hardcoded here — swapping tenants changes the color automatically.
 *
 * The useTenantTheme hook is used only for branding *metadata* (logo URL,
 * app name) that can't be expressed as a CSS variable.
 */
import React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Search } from 'lucide-react';
import { useTenantTheme } from '@/contexts/TenantThemeContext';

const ModuleHeader = ({
  title,
  subtitle,
  showBack = false,
  onBack,
  showSearch = true,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  rightContent,
}) => {
  const router = useRouter();
  const { branding } = useTenantTheme();

  const handleBack = () => {
    if (onBack) onBack();
    else router.back();
  };

  return (
    <div
      className="bg-primary sticky top-0 z-20 px-4 pb-4"
      style={{
        borderBottomLeftRadius: '24px',
        borderBottomRightRadius: '24px',
        paddingTop: 'max(16px, env(safe-area-inset-top, 16px))',
      }}
    >
      <div className="flex items-center gap-3 mb-2">
        {showBack && (
          <button
            onClick={handleBack}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.2)' }}
            aria-label="Go back"
          >
            <ChevronLeft className="h-5 w-5 text-white" />
          </button>
        )}

        <div className="flex-1 min-w-0">
          {branding?.logo_url && !title ? (
            <img
              src={branding.logo_url}
              alt={branding.app_name || 'College logo'}
              className="h-8 object-contain"
            />
          ) : (
            <h1 className="text-xl font-bold text-white leading-tight truncate">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="text-sm text-white/75 leading-tight">{subtitle}</p>
          )}
        </div>

        {rightContent && (
          <div className="flex-shrink-0">{rightContent}</div>
        )}
      </div>

      {showSearch && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 mt-1 rounded-2xl"
          style={{ background: 'rgba(255,255,255,0.22)' }}
        >
          <Search className="h-4 w-4 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.75)' }} />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="bg-transparent border-none outline-none text-sm w-full"
            style={{ color: 'white' }}
          />
        </div>
      )}
    </div>
  );
};

export default ModuleHeader;
