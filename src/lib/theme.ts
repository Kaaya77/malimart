// =====================================================================
// theme.ts — applies user customization safely.
// Accents are a curated palette (validated again server-side), so users
// can personalize without injecting arbitrary CSS or breaking contrast.
// Call applyTheme(profile) once after login and after settings save.
// =====================================================================

export type ThemeMode = "light" | "dark" | "system";

export const ACCENTS: Record<string, { base: string; soft: string; on: string }> = {
  emerald: { base: "#0E9F6E", soft: "#D1FAE5", on: "#FFFFFF" },
  ocean:   { base: "#0369A1", soft: "#E0F2FE", on: "#FFFFFF" },
  sunset:  { base: "#C2410C", soft: "#FFEDD5", on: "#FFFFFF" },
  plum:    { base: "#7E22CE", soft: "#F3E8FF", on: "#FFFFFF" },
  sand:    { base: "#A16207", soft: "#FEF9C3", on: "#FFFFFF" },
};

export interface ThemeSettings {
  theme_mode?: ThemeMode | null;
  theme_accent?: string | null;
  reduced_motion?: boolean | null;
  high_contrast_mode?: boolean | null;
}

export function applyTheme(s: ThemeSettings) {
  const root = document.documentElement;

  // Mode
  const mode = s.theme_mode ?? "system";
  const dark =
    mode === "dark" ||
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);

  // Accent (whitelist only — anything unknown falls back to emerald)
  const accent = ACCENTS[s.theme_accent ?? ""] ?? ACCENTS.emerald;
  root.style.setProperty("--mm-accent", accent.base);
  root.style.setProperty("--mm-accent-soft", accent.soft);
  root.style.setProperty("--mm-accent-on", accent.on);

  // Motion & contrast
  root.classList.toggle("mm-reduced-motion", !!s.reduced_motion);
  root.classList.toggle("mm-high-contrast", !!s.high_contrast_mode);
}

/* Add once to index.css:
:root { --mm-accent:#0E9F6E; --mm-accent-soft:#D1FAE5; --mm-accent-on:#fff; }
.mm-reduced-motion *, .mm-reduced-motion *::before, .mm-reduced-motion *::after {
  animation-duration: 0.01ms !important; transition-duration: 0.01ms !important;
}
.mm-high-contrast { --mm-accent: #065F46; }
Then use Tailwind arbitrary values: bg-[var(--mm-accent)] text-[var(--mm-accent-on)]
*/
