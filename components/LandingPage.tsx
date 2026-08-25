'use client';

import { ThemeToggle } from './ThemeToggle';

export function LandingPage() {
  return (
    <div
      className="min-h-screen flex flex-col"
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
          <h1
            className="text-lg sm:text-xl font-bold text-[var(--qf-text-1)]"
            style={{ fontFamily: 'var(--font-poppins), sans-serif' }}
          >
            Stellar4
          </h1>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-12 sm:py-16">
        <p className="text-center text-[var(--qf-text-2)] text-base sm:text-lg max-w-xl mx-auto mb-10 leading-relaxed">
          Play the game, then list items on the Marketplace — sale, auction, or
          trade on Stellar testnet.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 max-w-3xl mx-auto">
          <a
            href="/play"
            data-hook="landing-play"
            className="rounded-2xl border border-[var(--qf-card-border)] p-6 no-underline hover:border-[var(--qf-text-3)] transition-colors"
            style={{ background: 'var(--qf-card-bg)' }}
          >
            <p
              className="text-xl font-semibold text-[var(--qf-text-1)] mb-2"
              style={{ fontFamily: 'var(--font-poppins), sans-serif' }}
            >
              Play
            </p>
            <p className="text-sm text-[var(--qf-text-3)] leading-relaxed">
              Spin for items, manage inventory, equip weapons, and export to NFT.
            </p>
          </a>
          <a
            href="/market"
            data-hook="landing-market"
            className="rounded-2xl border border-[var(--qf-card-border)] p-6 no-underline hover:border-[var(--qf-text-3)] transition-colors"
            style={{ background: 'var(--qf-card-bg)' }}
          >
            <p
              className="text-xl font-semibold text-[var(--qf-text-1)] mb-2"
              style={{ fontFamily: 'var(--font-poppins), sans-serif' }}
            >
              Marketplace
            </p>
            <p className="text-sm text-[var(--qf-text-3)] leading-relaxed">
              Sale, Auction, and Trade for exported NFTs.
            </p>
          </a>
        </div>
      </main>

      <footer className="border-t border-[var(--qf-card-border)] py-5 text-center text-[12px] text-[var(--qf-text-4)]">
        Stellar testnet · No real funds
      </footer>
    </div>
  );
}
