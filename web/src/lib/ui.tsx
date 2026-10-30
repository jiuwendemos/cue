import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { translate, type Locale } from "./i18n";

export type Theme = "dark" | "light" | "contrast";
export type Role = "designer" | "producer" | "crew" | "tour_manager" | "admin";
export type Density = "comfortable" | "compact";

interface StoredUI {
  theme: Theme;
  role: Role;
  locale: Locale;
  density: Density;
  reducedMotion: boolean;
  showDemoNotices: boolean;
  introSeen: boolean;
}

const KEY = "cue.ui.v2";
const DEFAULT: StoredUI = {
  theme: "dark",
  role: "designer",
  locale: "en",
  density: "comfortable",
  reducedMotion: false,
  showDemoNotices: true,
  introSeen: false,
};

function load(): StoredUI {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...(JSON.parse(raw) as Partial<StoredUI>) };
  } catch {
    return DEFAULT;
  }
}

interface UIValue extends StoredUI {
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setRole: (role: Role) => void;
  setLocale: (locale: Locale) => void;
  setDensity: (density: Density) => void;
  setReducedMotion: (v: boolean) => void;
  setShowDemoNotices: (v: boolean) => void;
  markIntroSeen: () => void;
  replayIntro: () => void;
  t: (key: string) => string;
}

const UIContext = createContext<UIValue | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoredUI>(() => load());

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* private mode */
    }
    const root = document.documentElement;
    root.dataset.theme = state.theme;
    root.dataset.density = state.density;
    root.dataset.locale = state.locale;
    root.lang = state.locale === "zh" ? "zh-CN" : "en";
    if (state.reducedMotion) root.dataset.reducedMotion = "true";
    else delete root.dataset.reducedMotion;
  }, [state]);

  const setTheme = useCallback((theme: Theme) => setState((s) => ({ ...s, theme })), []);
  const toggleTheme = useCallback(
    () => setState((s) => ({ ...s, theme: s.theme === "dark" ? "light" : s.theme === "light" ? "contrast" : "dark" })),
    [],
  );
  const setRole = useCallback((role: Role) => setState((s) => ({ ...s, role })), []);
  const setLocale = useCallback((locale: Locale) => setState((s) => ({ ...s, locale })), []);
  const setDensity = useCallback((density: Density) => setState((s) => ({ ...s, density })), []);
  const setReducedMotion = useCallback((reducedMotion: boolean) => setState((s) => ({ ...s, reducedMotion })), []);
  const setShowDemoNotices = useCallback((showDemoNotices: boolean) => setState((s) => ({ ...s, showDemoNotices })), []);
  const markIntroSeen = useCallback(() => setState((s) => ({ ...s, introSeen: true })), []);
  const replayIntro = useCallback(() => setState((s) => ({ ...s, introSeen: false })), []);
  const t = useCallback((key: string) => translate(state.locale, key), [state.locale]);

  const value = useMemo<UIValue>(
    () => ({
      ...state,
      setTheme,
      toggleTheme,
      setRole,
      setLocale,
      setDensity,
      setReducedMotion,
      setShowDemoNotices,
      markIntroSeen,
      replayIntro,
      t,
    }),
    [state, setTheme, toggleTheme, setRole, setLocale, setDensity, setReducedMotion, setShowDemoNotices, markIntroSeen, replayIntro, t],
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI(): UIValue {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useUI must be used inside UIProvider");
  return ctx;
}
