export const THEME_COOKIE = "theme";

export const themes = ["system", "light", "dark"] as const;

export type Theme = (typeof themes)[number];

export function isTheme(value: string | undefined): value is Theme {
  return value === "system" || value === "light" || value === "dark";
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.cookie = `${THEME_COOKIE}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/** Runs before paint so the root attribute is set when colour tokens are applied. */
export function themeBootScript(): string {
  return `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark|system)(?:;|$)/);document.documentElement.dataset.theme=m?m[1]:"system"}catch(e){document.documentElement.dataset.theme="system"}})();`;
}
