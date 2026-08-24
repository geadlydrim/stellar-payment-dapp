'use client';

import dynamic from 'next/dynamic';

const PlayShell = dynamic(
  () => import('@/components/identity/PlayShell').then((m) => m.PlayShell),
  {
    ssr: false,
    loading: () => (
      <div
        className="min-h-screen flex items-center justify-center text-[var(--qf-text-3)] text-sm"
        style={{
          background:
            'linear-gradient(180deg, var(--qf-bg-1), var(--qf-bg-2) 60%, var(--qf-bg-1))',
        }}
      >
        Loading Stellar4…
      </div>
    ),
  }
);

export default function PlayPage() {
  return <PlayShell />;
}
