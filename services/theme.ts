// =====================================================================
// theme.ts — applies user appearance customization safely.
//
// The whole app is styled with Tailwind `emerald-*` utilities, which in
// Tailwind v4 resolve to `var(--color-emerald-<step>)`. So a personal accent
// theme just needs to override that scale on <html> — every emerald surface,
// ring, badge and button recolours at once, with contrast preserved because we
// generate a full, balanced 50→950 ramp per preset.
//
// Accents are a fixed, curated set (validated again server-side), so users
// personalize without injecting arbitrary CSS or breaking contrast.
// Call applyTheme(profile) once after login and after every settings save.
// =====================================================================

export type ThemeMode = "light" | "dark" | "system";

// Lightness ramp (%) roughly matching Tailwind's default numeric steps.
const RAMP: Record<number, number> = {
  50: 97, 100: 93, 200: 86, 300: 76, 400: 64, 500: 52, 600: 44, 700: 36, 800: 29, 900: 23, 950: 15,
};
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

export interface AccentPreset {
  /** Stable key persisted to profiles.theme_accent. */
  key: string;
  /** Human label for the picker. */
  label: string;
  hue: number;
  sat: number;
  /** Swatch color shown in the picker (its own 500 step). */
  swatch: string;
}

// `emerald` is the default — it maps to the app's built-in brand green, so we
// leave the Tailwind scale untouched for it (see applyTheme).
export const ACCENT_PRESETS: AccentPreset[] = [
  { key: "emerald", label: "Emerald",  hue: 160, sat: 84, swatch: "#10b981" },
  { key: "ocean",   label: "Ocean",    hue: 205, sat: 82, swatch: "#0ea5e9" },
  { key: "violet",  label: "Violet",   hue: 264, sat: 68, swatch: "#8b5cf6" },
  { key: "rose",    label: "Rose",     hue: 345, sat: 74, swatch: "#f43f5e" },
  { key: "amber",   label: "Amber",    hue: 35,  sat: 92, swatch: "#f59e0b" },
  { key: "teal",    label: "Teal",     hue: 175, sat: 66, swatch: "#14b8a6" },
  { key: "indigo",  label: "Indigo",   hue: 234, sat: 62, swatch: "#6366f1" },
  { key: "slate",   label: "Graphite", hue: 220, sat: 12, swatch: "#64748b" },
];

export const ACCENT_KEYS = ACCENT_PRESETS.map(p => p.key);

export interface ThemeSettings {
  theme_mode?: ThemeMode | null;
  theme_accent?: string | null;
  reduced_motion?: boolean | null;
  high_contrast_mode?: boolean | null;
}

const scaleFor = (hue: number, sat: number): Record<number, string> => {
  const out: Record<number, string> = {};
  for (const step of STEPS) out[step] = `hsl(${hue} ${sat}% ${RAMP[step]}%)`;
  return out;
};

const clearAccentVars = (root: HTMLElement) => {
  for (const step of STEPS) root.style.removeProperty(`--color-emerald-${step}`);
};

/**
 * Apply ONLY the accent recolour (no dark/light or motion changes). Use this for
 * live preview from the settings picker, where the app owns dark mode separately
 * — calling full applyTheme there could flip the user's theme as a side effect.
 */
export function applyAccent(accentKey?: string | null) {
  const root = document.documentElement;
  const preset = ACCENT_PRESETS.find(p => p.key === (accentKey ?? 'emerald'));
  if (!preset || preset.key === 'emerald') {
    clearAccentVars(root);
    return;
  }
  // Override the whole emerald scale. Tailwind v4 emits every `emerald-*` and
  // `emerald-*/<opacity>` utility (all steps, all variants — hover/dark/
  // focus-visible/…) as `color-mix(in oklab, var(--color-emerald-<step>) …)`
  // guarded by `@supports (color-mix)`, and that rule wins over the literal
  // fallback on any browser with color-mix support. So setting these vars alone
  // recolours 100% of emerald surfaces — no per-utility stylesheet needed.
  const scale = scaleFor(preset.hue, preset.sat);
  for (const step of STEPS) root.style.setProperty(`--color-emerald-${step}`, scale[step]);
}

export function applyTheme(s: ThemeSettings) {
  const root = document.documentElement;

  // Mode
  const mode = s.theme_mode ?? "system";
  const dark =
    mode === "dark" ||
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);

  // Accent — override the emerald scale AND the baked-literal opacity utilities
  // (see applyAccent) so every emerald surface follows the chosen accent.
  applyAccent(s.theme_accent ?? "emerald");

  // Motion & contrast
  root.classList.toggle("mm-reduced-motion", !!s.reduced_motion);
  root.classList.toggle("mm-high-contrast", !!s.high_contrast_mode);
}
