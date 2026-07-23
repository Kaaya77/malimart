import React from 'react';
import { Check } from 'lucide-react';
import { ACCENT_PRESETS, applyTheme, ThemeMode } from '../services/theme';

interface AccentThemePickerProps {
  /** Currently selected accent key (defaults to emerald). */
  value?: string | null;
  /** Current theme mode, so a live preview keeps light/dark correct. */
  mode?: ThemeMode | null;
  /** Persist the chosen key (e.g. updateUserProfile). */
  onSelect: (key: string) => void;
}

/**
 * Preset accent-theme picker. Selecting a swatch recolours the whole app live
 * (applyTheme overrides the emerald scale), then persists via onSelect.
 */
export const AccentThemePicker: React.FC<AccentThemePickerProps> = ({ value, mode, onSelect }) => {
  const active = value || 'emerald';

  const choose = (key: string) => {
    applyTheme({ theme_accent: key, theme_mode: mode ?? undefined });
    onSelect(key);
  };

  return (
    <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
      {ACCENT_PRESETS.map(p => {
        const selected = p.key === active;
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => choose(p.key)}
            aria-pressed={selected}
            aria-label={`${p.label} theme`}
            title={p.label}
            className={`group relative flex flex-col items-center gap-1.5 focus-visible:outline-none`}
          >
            <span
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all shadow-sm
                ${selected ? 'ring-2 ring-offset-2 ring-offset-background scale-105' : 'hover:scale-105'}`}
              style={{ background: p.swatch, boxShadow: selected ? `0 6px 18px -4px ${p.swatch}` : undefined, ...(selected ? { ['--tw-ring-color' as any]: p.swatch } : {}) }}
            >
              {selected && <Check className="w-5 h-5 text-white stroke-[3]" />}
            </span>
            <span className={`text-[10px] font-semibold ${selected ? 'text-foreground' : 'text-foreground/50'}`}>{p.label}</span>
          </button>
        );
      })}
    </div>
  );
};
