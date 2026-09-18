import { create } from 'zustand';

type Theme = 'light' | 'dark';

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark') return stored;
  // The site now leads with light (warm paper). Honour an explicit OS dark preference,
  // but fall back to light where matchMedia is unavailable (e.g. jsdom in tests).
  if (typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
}

// Scoped to the public site: PublicLayout renders `<div className={theme}>` around all
// public pages, so Tailwind's `dark:` variant activates only within that subtree. The
// admin panel never reads this store, so it's unaffected regardless of the toggle state.
export const useTheme = create<ThemeState>((set, get) => ({
  theme: getInitialTheme(),
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    set({ theme: next });
  },
}));
