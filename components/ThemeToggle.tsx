'use client';

import { useTheme } from './ThemeProvider';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full border border-[var(--qf-card-border)] bg-[var(--qf-card-bg)] hover:bg-[var(--qf-card-bg-soft)] text-sm cursor-pointer transition-colors"
    >
      {theme === 'dark' ? '🌙' : '☀️'}
    </button>
  );
}
