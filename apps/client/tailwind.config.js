/** @type {import('tailwindcss').Config} */

/*
 * Design language: warm minimalist "paper & ink".
 *
 * The whole app is re-skinned from one place. `slate`, `indigo` and `emerald` are
 * overridden here rather than swept across ~55 files — every existing
 * `bg-slate-50` / `text-indigo-600` / `dark:bg-slate-900` keeps working and simply
 * renders in the warm palette. The `dark:` variants already in the components handle
 * light/dark switching; each shade just needs one warm value.
 *
 *   slate   → warm greige neutrals (off-white paper ↔ warm soft-black)
 *   indigo  → clay / terracotta (the single accent: links, focus, CTAs, glows)
 *   emerald → muted sage (used sparingly — skill bars, a few icons)
 *
 * Contrast was checked against the shades the components actually pair: headings use
 * 900/white, body uses 600/300, muted meta uses 500/400.
 */

const slate = {
  50: '#faf9f6',
  100: '#f3f1ea',
  200: '#e7e3da',
  300: '#d6d1c4',
  400: '#a39c8d',
  500: '#79736a',
  600: '#5c564c',
  700: '#4c463d',
  800: '#383229',
  900: '#2a251e',
  950: '#1c1813',
};

const indigo = {
  50: '#f6eee9',
  100: '#ecd9cc',
  200: '#debba4',
  300: '#ce9a78',
  400: '#c07e5c',
  500: '#ae6a47',
  600: '#9a5537',
  700: '#814430',
  800: '#5f3426',
  900: '#43271e',
  950: '#2a1813',
};

const emerald = {
  50: '#eef1e8',
  100: '#dbe1cb',
  200: '#c3cdaa',
  300: '#a9b788',
  400: '#93a277',
  500: '#7b8a5f',
  600: '#63724a',
  700: '#4d5a3a',
  800: '#3a4430',
  900: '#2f3728',
  950: '#191d14',
};

export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slate,
        indigo,
        emerald,
        primary: {
          DEFAULT: '#9a5537',
          hover: '#814430',
          glow: 'rgba(154, 85, 55, 0.14)',
        },
        accent: {
          DEFAULT: '#7b8a5f',
          glow: 'rgba(123, 138, 95, 0.14)',
        },
        dark: {
          bg: '#1c1813',
          card: '#2a251e',
          border: 'rgba(255, 255, 255, 0.07)',
        },
      },
      fontFamily: {
        heading: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        // Warm-tinted elevation instead of the default cold black.
        soft: '0 1px 2px rgba(44, 37, 30, 0.04), 0 8px 24px -8px rgba(44, 37, 30, 0.10)',
        lift: '0 2px 4px rgba(44, 37, 30, 0.05), 0 24px 48px -16px rgba(44, 37, 30, 0.20)',
        float: '0 30px 60px -20px rgba(44, 37, 30, 0.28)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        // Slow rotation for the hero's agent sigil — the default `spin` (1s) reads
        // as a loading spinner; this reads as "thinking".
        'agent-spin': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        float: 'float 7s ease-in-out infinite',
        'fade-up': 'fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        blink: 'blink 1.1s step-end infinite',
        'agent-spin': 'agent-spin 2.6s linear infinite',
      },
    },
  },
  plugins: [],
}
