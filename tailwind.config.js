/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          canvas: 'var(--color-canvas)',
          surface: 'var(--color-surface)',
          elevated: 'var(--color-elevated)',
          overlay: 'var(--color-overlay)',
          lowest: 'var(--color-lowest)',
          border: 'var(--color-border)',
          'border-subtle': 'var(--color-border-subtle)',
          'border-strong': 'var(--color-border-strong)',
          muted: 'var(--color-text-muted)',
          faint: 'var(--color-text-faint)',
        },
        violet: {
          accent: 'var(--color-accent)',
          hover: 'var(--color-accent-hover)',
          container: '#2A039D',
          muted: 'var(--color-accent-muted)',
        },
        emerald: {
          accent: 'var(--color-emerald)',
          muted: 'var(--color-emerald-muted)',
        },
        crimson: {
          accent: 'var(--color-crimson)',
          muted: 'var(--color-crimson-muted)',
        },
        white: 'var(--color-text-main)',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Geist', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
