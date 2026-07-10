import { useState, type CSSProperties } from 'react';
import { CopyButton } from '../ui/CopyButton';
import { QRCode } from '../ui/QRCode';

export function WalletStep({
  connected,
  connecting,
  error,
  publicKey,
  shortAddress,
  onConnect,
  onDisconnect,
}: {
  connected: boolean;
  connecting: boolean;
  error: string;
  publicKey: string;
  shortAddress: string;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const [showQR, setShowQR] = useState(false);

  const primaryBtnStyle: CSSProperties = {
    background: 'linear-gradient(135deg,var(--qf-accent-1),var(--qf-accent-2))',
    color: 'var(--qf-accent-ink)',
    boxShadow: '0 6px 18px var(--qf-accent-glow)',
    animation: 'qf-breathe 2.6s ease-in-out infinite',
    animationPlayState: connecting ? 'paused' : 'running',
  };

  if (connected) {
    return (
      <div>
        <div className="flex items-center justify-between gap-2.5 mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--qf-accent-2)]" />
            <span className="text-[13.5px] text-[var(--qf-text-2)]">Wallet connected</span>
          </div>
          <button
            onClick={onDisconnect}
            className="border border-[var(--qf-input-border)] bg-[var(--qf-input-bg)] hover:bg-[var(--qf-card-border-soft)] text-[var(--qf-text-2)] cursor-pointer text-[12.5px] font-medium py-[7px] px-3.5 rounded-full transition-colors flex-shrink-0"
          >
            Disconnect
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[12.5px] text-[var(--qf-text-3)]">{shortAddress}</span>
          <CopyButton text={publicKey} />
          <button
            onClick={() => setShowQR((v) => !v)}
            className="text-[var(--qf-text-3)] cursor-pointer text-[11.5px] underline decoration-dotted transition-colors"
          >
            {showQR ? 'hide QR' : 'show QR'}
          </button>
        </div>

        {showQR && (
          <div className="mt-3">
            <QRCode value={publicKey} />
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <h2 className="mt-1 mb-2 font-poppins font-semibold text-[21px] text-[var(--qf-text-1)]">
        Connect your wallet
      </h2>
      <p className="mb-5 text-[14.5px] leading-relaxed text-[var(--qf-text-2)]">
        Connect a wallet to view your balance, send payments, and see your history.
      </p>
      <button
        onClick={onConnect}
        disabled={connecting}
        style={primaryBtnStyle}
        className="border-none cursor-pointer font-poppins font-semibold text-[15px] py-[15px] px-7 rounded-full w-full transition-transform duration-[220ms] ease-[cubic-bezier(.34,1.56,.64,1)] hover:scale-[1.035] active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
      >
        {connecting && (
          <span
            className="w-4 h-4 rounded-full border-2 border-r-transparent inline-block animate-spin opacity-55"
            style={{ borderColor: 'var(--qf-accent-ink)', borderRightColor: 'transparent' }}
          />
        )}
        {connecting ? 'Connecting…' : 'Connect wallet'}
      </button>
      {error && <p className="mt-2 text-[12.5px] text-[#EF4444]">{error}</p>}
    </>
  );
}
