'use client';

import { X } from 'lucide-react';

/**
 * BottomSheet — slides up from the bottom of the screen.
 *
 * Structure:
 *   - Fixed header  (title + close button, always visible)
 *   - Scrollable body  (form fields / content)
 *   - Fixed footer  (primary action button, always visible)
 *
 * maxHeight defaults to 90dvh which reacts correctly when the
 * soft keyboard opens on mobile (dvh = dynamic viewport height).
 */
export function BottomSheet({ open, onClose, title, children, footer, maxHeight = '90dvh' }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg rounded-t-3xl flex flex-col"
        style={{ maxHeight }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex-shrink-0 px-6 pt-6 pb-4 flex items-center justify-between">
          <h3 className="font-bold text-lg">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-2">
          {children}
        </div>

        {footer && (
          <div
            className="flex-shrink-0 px-6 pt-4 pb-6"
            style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
