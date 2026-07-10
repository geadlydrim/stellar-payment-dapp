'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { AddressBook } from '../AddressBook';

interface SendStepProps {
  disabled: boolean;
  recipient: string;
  amount: string;
  memo: string;
  recipientError: string;
  amountError: string;
  sending: boolean;
  sendError: string;
  lastTxHash: string;
  lastSentTo: string;
  explorerLink: (hash: string) => string;
  onRecipientChange: (v: string) => void;
  onAmountChange: (v: string) => void;
  onMemoChange: (v: string) => void;
  onValidate: () => boolean;
  onConfirmSend: () => void;
}

export function SendStep({
  disabled,
  recipient,
  amount,
  memo,
  recipientError,
  amountError,
  sending,
  sendError,
  lastTxHash,
  lastSentTo,
  explorerLink,
  onRecipientChange,
  onAmountChange,
  onMemoChange,
  onValidate,
  onConfirmSend,
}: SendStepProps) {
  const [confirming, setConfirming] = useState(false);
  const [justSucceeded, setJustSucceeded] = useState(false);
  const wasSending = useRef(false);

  useEffect(() => {
    if (wasSending.current && !sending && lastTxHash) {
      setJustSucceeded(true);
      const t = setTimeout(() => setJustSucceeded(false), 900);
      wasSending.current = sending;
      return () => clearTimeout(t);
    }
    wasSending.current = sending;
  }, [sending, lastTxHash]);

  if (disabled) {
    return <p className="mt-2 text-[14.5px] text-[var(--qf-text-4)]">Connect a wallet to send a payment.</p>;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onValidate()) setConfirming(true);
  };

  const handleConfirm = () => {
    setConfirming(false);
    onConfirmSend();
  };

  const primaryBtnStyle: CSSProperties = {
    background: 'linear-gradient(135deg,var(--qf-accent-1),var(--qf-accent-2))',
    color: 'var(--qf-accent-ink)',
    boxShadow: '0 6px 18px var(--qf-accent-glow)',
    animation: 'qf-breathe 2.6s ease-in-out infinite',
    animationPlayState: sending ? 'paused' : 'running',
  };
  const confirmBtnStyle: CSSProperties = {
    background: 'linear-gradient(135deg,var(--qf-accent-1),var(--qf-accent-2))',
    color: 'var(--qf-accent-ink)',
    boxShadow: '0 6px 16px var(--qf-accent-glow)',
  };
  const spinnerStyle: CSSProperties = { borderColor: 'var(--qf-accent-ink)', borderRightColor: 'transparent' };

  return (
    <>
      <h2 className="mt-1 mb-[18px] font-poppins font-semibold text-[21px] text-[var(--qf-text-1)]">
        Send a payment
      </h2>

      {lastTxHash && (
        <div className="mb-4 bg-[#22C55E]/10 border border-[#22C55E]/30 rounded-2xl p-3.5 text-[12.5px] text-[var(--qf-text-2)]">
          <p className="mb-1 text-[#16A34A] font-semibold">✓ Sent — confirmed on-chain</p>
          <p className="mb-1 font-mono break-all text-[var(--qf-text-2)]">
            Transaction hash: {lastTxHash}
          </p>
          <a
            href={explorerLink(lastTxHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#16A34A] underline break-all"
          >
            view on Stellar Expert →
          </a>
        </div>
      )}
      {sendError && (
        <div className="mb-4 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-2xl p-3.5 text-[12.5px] text-[#EF4444]">
          {sendError}
        </div>
      )}

      {confirming ? (
        <div className="bg-[var(--qf-input-bg)] border border-[var(--qf-input-border)] rounded-2xl p-4">
          <p className="text-[11px] tracking-[0.06em] uppercase text-[var(--qf-text-4)] font-poppins font-semibold mb-3">
            Confirm payment
          </p>
          <div className="flex flex-col gap-2.5 mb-4">
            <div className="flex justify-between gap-3">
              <span className="text-[12.5px] text-[var(--qf-text-3)]">To</span>
              <span className="text-[12.5px] font-mono text-[var(--qf-text-1)] text-right break-all">
                {recipient}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-[12.5px] text-[var(--qf-text-3)]">Amount</span>
              <span className="text-[14px] font-poppins font-semibold text-[var(--qf-text-1)]">
                {amount} XLM
              </span>
            </div>
            {memo && (
              <div className="flex justify-between gap-3">
                <span className="text-[12.5px] text-[var(--qf-text-3)]">Memo</span>
                <span className="text-[12.5px] text-[var(--qf-text-1)] text-right">{memo}</span>
              </div>
            )}
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={() => setConfirming(false)}
              disabled={sending}
              className="flex-1 border border-[var(--qf-input-border)] bg-transparent cursor-pointer text-[var(--qf-text-2)] font-medium text-[13.5px] py-3 px-4 rounded-full transition-colors hover:bg-[var(--qf-card-border-soft)] disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={sending}
              style={confirmBtnStyle}
              className="flex-1 border-none cursor-pointer font-poppins font-semibold text-[13.5px] py-3 px-4 rounded-full inline-flex items-center justify-center gap-1.5 transition-transform duration-[220ms] ease-[cubic-bezier(.34,1.56,.64,1)] hover:scale-[1.035] active:scale-[0.97] disabled:opacity-60"
            >
              {sending && (
                <span
                  className="w-[15px] h-[15px] rounded-full border-2 border-r-transparent inline-block animate-spin opacity-55"
                  style={spinnerStyle}
                />
              )}
              {justSucceeded && (
                <span className="inline-block" style={{ animation: 'qf-check-pop 0.4s cubic-bezier(.34,1.56,.64,1) both' }}>
                  ✓
                </span>
              )}
              {sending ? 'Sending…' : justSucceeded ? 'Sent!' : 'Confirm & Send'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <AddressBook recipient={recipient} onPick={onRecipientChange} lastSentTo={lastSentTo} />
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block mb-1.5 text-[12.5px] text-[var(--qf-text-3)]">To</label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => onRecipientChange(e.target.value)}
                placeholder="G…"
                className="w-full box-border bg-[var(--qf-input-bg)] border border-[var(--qf-input-border)] rounded-xl py-[13px] px-3.5 text-[var(--qf-text-1)] font-mono text-[13.5px] placeholder-[var(--qf-text-4)] focus:outline-none"
              />
              {recipientError && <p className="mt-1.5 text-[12.5px] text-[#EF4444]">{recipientError}</p>}
            </div>
            <div>
              <label className="block mb-1.5 text-[12.5px] text-[var(--qf-text-3)]">Amount</label>
              <input
                type="text"
                value={amount}
                onChange={(e) => onAmountChange(e.target.value)}
                placeholder="0.00"
                className="w-full box-border bg-[var(--qf-input-bg)] border border-[var(--qf-input-border)] rounded-xl py-[13px] px-3.5 text-[var(--qf-text-1)] text-[14.5px] placeholder-[var(--qf-text-4)] focus:outline-none"
              />
              {amountError && <p className="mt-1.5 text-[12.5px] text-[#EF4444]">{amountError}</p>}
            </div>
            <div>
              <label className="block mb-1.5 text-[12.5px] text-[var(--qf-text-3)]">Memo (optional)</label>
              <input
                type="text"
                value={memo}
                onChange={(e) => onMemoChange(e.target.value)}
                placeholder="hey, this one's on me"
                className="w-full box-border bg-[var(--qf-input-bg)] border border-[var(--qf-input-border)] rounded-xl py-[13px] px-3.5 text-[var(--qf-text-1)] text-[14.5px] placeholder-[var(--qf-text-4)] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={sending}
              style={primaryBtnStyle}
              className="border-none cursor-pointer font-poppins font-semibold text-[15px] py-[15px] px-5 rounded-full mt-1 transition-transform duration-[220ms] ease-[cubic-bezier(.34,1.56,.64,1)] hover:scale-[1.035] active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {sending ? 'Sending…' : 'Review payment'}
            </button>
          </form>
        </>
      )}
    </>
  );
}
