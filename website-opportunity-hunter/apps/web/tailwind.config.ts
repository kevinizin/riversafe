import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0f1720', soft: '#1a242f', line: '#25313d' },
        paper: '#f7f8fa',
        brand: { DEFAULT: '#1f6feb', dark: '#1a5fd0' },
        hot: '#e5484d',
        high: '#f76b15',
        warm: '#f2b705',
        low: '#3b82f6',
        ignore: '#8b949e',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
