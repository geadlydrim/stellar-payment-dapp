'use client';

import { useTheme } from './ThemeProvider';

export function ThemeToggle() {
  const { palette, mode, setPalette, toggleMode } = useTheme();

  const ringStyle = (active: boolean) =>
    active ? { boxShadow: '0 0 0 2px var(--qf-header-bg), 0 0 0 3.5px var(--qf-text-1)' } : undefined;

  return (
    <div className="flex items-center gap-1.5 bg-[var(--qf-input-bg)] border border-[var(--qf-card-border)] rounded-full p-1">
      <button
        onClick={() => setPalette('sherbet')}
        title="Sherbet theme"
        style={{
          background: 'linear-gradient(135deg,#FFC48C,#FF7E6B)',
          ...ringStyle(palette === 'sherbet'),
        }}
        className="w-[22px] h-[22px] rounded-full border-none cursor-pointer p-0 flex-shrink-0"
      />
      <button
        onClick={() => setPalette('mintfog')}
        title="Mint Fog theme"
        style={{
          background: 'linear-gradient(135deg,#A9EEDD,#86C6EF)',
          ...ringStyle(palette === 'mintfog'),
        }}
        className="w-[22px] h-[22px] rounded-full border-none cursor-pointer p-0 flex-shrink-0"
      />
      <button
        onClick={toggleMode}
        title={mode === 'day' ? 'Switch to night mode' : 'Switch to day mode'}
        className="w-[26px] h-[26px] flex-shrink-0 flex items-center justify-center rounded-full border-none bg-transparent text-[13px] cursor-pointer text-[var(--qf-text-2)]"
      >
        {mode === 'day' ? '☀️' : '🌙'}
      </button>
    </div>
  );
}
