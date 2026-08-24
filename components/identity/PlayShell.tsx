'use client';

import { useState, type ReactNode } from 'react';
import { PlayApp } from '@/components/game/PlayApp';
import { ThemeToggle } from '@/components/ThemeToggle';
import { shortOwnerId } from '@/lib/identity/owner';
import { useWalletSession } from './WalletSessionProvider';

function PlayFrame({
  headerActions,
  children,
}: {
  headerActions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="min-h-screen"
      style={{
        background:
          'linear-gradient(180deg, var(--qf-bg-1), var(--qf-bg-2) 55%, var(--qf-bg-1))',
      }}
    >
      <header
        className="sticky top-0 z-40 border-b border-[var(--qf-card-border)] backdrop-blur-md"
        style={{ background: 'var(--qf-header-bg)' }}
      >
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <a
              href="/"
              className="text-xs text-[var(--qf-text-4)] hover:text-[var(--qf-text-2)] no-underline"
            >
              ← Home
            </a>
            <h1
              className="text-lg sm:text-xl font-bold text-[var(--qf-text-1)] truncate"
              style={{ fontFamily: 'var(--font-poppins), sans-serif' }}
            >
              Stellar4
            </h1>
            <span className="hidden sm:inline text-xs text-[var(--qf-text-4)]">
              Play
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/market"
              className="text-xs font-medium text-[var(--qf-text-2)] no-underline hover:text-[var(--qf-text-1)]"
            >
              Market
            </a>
            {headerActions}
            <ThemeToggle />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

function ConnectGate({
  connecting,
  error,
  onConnect,
}: {
  connecting: boolean;
  error: string | null;
  onConnect: () => void;
}) {
  return (
    <PlayFrame
      headerActions={
        <button
          type="button"
          data-hook="play-connect-wallet"
          onClick={onConnect}
          disabled={connecting}
          className="text-xs font-semibold rounded-full py-1.5 px-3 border-none cursor-pointer disabled:opacity-60"
          style={{
            background:
              'linear-gradient(135deg, var(--qf-accent-1), var(--qf-accent-2))',
            color: 'var(--qf-accent-ink)',
          }}
        >
          {connecting ? 'Connecting…' : 'Connect wallet'}
        </button>
      }
    >
      <main className="max-w-5xl mx-auto px-4 py-16 space-y-3">
        <h2
          className="text-xl font-bold text-[var(--qf-text-1)]"
          style={{ fontFamily: 'var(--font-poppins), sans-serif' }}
        >
          Connect to play
        </h2>
        <p className="text-sm text-[var(--qf-text-3)] max-w-md">
          Stellar mode uses your connected wallet as the player. Spin and export
          stay off until a testnet account (G…) is connected. Guest inventory is
          not shown.
        </p>
        {error && (
          <p className="text-sm text-red-400" data-hook="play-connect-error">
            {error}
          </p>
        )}
      </main>
    </PlayFrame>
  );
}

export function PlayShell() {
  const { hydrated, connecting, session, connect, disconnect } =
    useWalletSession();
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setError(null);
    try {
      await connect();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Wallet connection failed — try Freighter on testnet'
      );
    }
  };

  if (!hydrated) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-[var(--qf-text-3)] text-sm"
        style={{
          background:
            'linear-gradient(180deg, var(--qf-bg-1), var(--qf-bg-2) 60%, var(--qf-bg-1))',
        }}
      >
        Loading Stellar4…
      </div>
    );
  }

  if (!session) {
    return (
      <ConnectGate
        connecting={connecting}
        error={error}
        onConnect={() => void handleConnect()}
      />
    );
  }

  return (
    <div>
      {session.kind === 'wallet' && (
        <div
          data-hook="play-session-banner"
          className="border-b border-[var(--qf-card-border)]"
          style={{ background: 'var(--qf-header-bg)' }}
        >
          <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
            <p className="text-xs text-[var(--qf-text-3)] min-w-0">
              Playing as{' '}
              <span className="font-mono text-[var(--qf-text-2)]">
                {shortOwnerId(session.ownerId)}
              </span>{' '}
              — inventory is for this wallet only.
            </p>
            <button
              type="button"
              data-hook="play-disconnect"
              onClick={disconnect}
              className="shrink-0 text-xs text-[var(--qf-text-2)] border border-[var(--qf-card-border)] bg-transparent rounded-full py-1 px-2.5 cursor-pointer"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}
      <PlayApp ownerId={session.ownerId} />
    </div>
  );
}
