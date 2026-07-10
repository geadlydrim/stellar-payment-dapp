'use client';

import { useState } from 'react';

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Copy address'}
      className="text-[var(--qf-text-3)] hover:text-[var(--qf-text-1)] cursor-pointer text-xs flex-shrink-0 transition-colors"
    >
      {copied ? '✓' : '⧉'}
    </button>
  );
}
