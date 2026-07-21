'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import {
  type Auction,
  auctionStatus,
  closeAuction,
  formatXlm,
  friendlyAuctionError,
  placeBid,
} from '@/lib/auction';
import type { TxStatus } from '@/lib/soroban';
import { TxStatusBanner } from './TxStatusBanner';

function shortAddr(addr: string) {
  if (!addr || addr.length < 10) return addr || '—';
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function useCountdown(endTime: number) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  const remaining = Math.max(0, endTime - now);
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  const label =
    remaining <= 0
      ? 'Ended'
      : h > 0
        ? `${h}h ${m}m ${s}s`
        : m > 0
          ? `${m}m ${s}s`
          : `${s}s`;
  return { remaining, label, now };
}

interface AuctionDetailProps {
  auction: Auction | null;
  publicKey: string | null;
  balanceXlm: number;
  explorerLink: (hash: string) => string;
  onUpdated: () => void;
  onSuccessToast: (msg: string) => void;
}

export function AuctionDetail({
  auction,
  publicKey,
  balanceXlm,
  explorerLink,
  onUpdated,
  onSuccessToast,
}: AuctionDetailProps) {
  const [bidAmount, setBidAmount] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [txStatus, setTxStatus] = useState<TxStatus | null>(null);
  const [txHash, setTxHash] = useState('');
  const [txError, setTxError] = useState('');
  const [action, setAction] = useState<'bid' | 'close' | null>(null);

  const endTime = auction?.endTime ?? 0;
  const { label, now } = useCountdown(endTime);

  useEffect(() => {
    setBidAmount('');
    setFieldError('');
    setTxStatus(null);
    setTxHash('');
    setTxError('');
    setAction(null);
  }, [auction?.id]);

  if (!auction) {
    return (
      <p className="text-[14px] text-[var(--qf-text-3)] py-4">
        Select an auction to view details and place a bid.
      </p>
    );
  }

  const status = auctionStatus(auction, now);
  const minBidStroops =
    auction.highestBid > 0 ? auction.highestBid + 1 : auction.startPrice;
  const minBidXlm = Number(minBidStroops) / 10_000_000;
  const isSeller = publicKey != null && publicKey === auction.seller;
  const canBid = status === 'live' && publicKey && !isSeller;
  const canClose = status === 'ended' && publicKey;

  const primaryBtnStyle: CSSProperties = {
    background: 'linear-gradient(135deg,var(--qf-accent-1),var(--qf-accent-2))',
    color: 'var(--qf-accent-ink)',
    boxShadow: '0 6px 18px var(--qf-accent-glow)',
  };

  const clearTx = () => {
    setTxStatus(null);
    setTxHash('');
    setTxError('');
    setAction(null);
  };

  const handleBid = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError('');
    clearTx();

    if (!publicKey) {
      setFieldError('Connect a wallet to bid.');
      return;
    }
    if (isSeller) {
      setFieldError('You cannot bid on your own auction.');
      return;
    }
    if (status !== 'live') {
      setFieldError('This auction has already ended.');
      return;
    }

    const amount = parseFloat(bidAmount);
    if (!bidAmount.trim() || isNaN(amount) || amount <= 0) {
      setFieldError('Enter a positive bid amount.');
      return;
    }
    if (amount < minBidXlm) {
      setFieldError(`Bid must be at least ${minBidXlm.toFixed(7)} XLM.`);
      return;
    }
    if (amount > balanceXlm) {
      setFieldError('Insufficient XLM balance for this bid.');
      return;
    }

    setAction('bid');
    setTxStatus('pending');
    try {
      const res = await placeBid({
        id: auction.id,
        bidder: publicKey,
        amountXlm: amount,
      });
      if (res.status === 'success') {
        setTxStatus('success');
        setTxHash(res.hash);
        setBidAmount('');
        onSuccessToast('Bid placed');
        onUpdated();
      } else {
        setTxStatus('fail');
        setTxHash(res.hash);
        setTxError(friendlyAuctionError(res.error || 'Bid failed'));
      }
    } catch (err) {
      setTxStatus('fail');
      setTxError(friendlyAuctionError(err));
    }
  };

  const handleClose = async () => {
    if (!publicKey) return;
    setFieldError('');
    clearTx();
    setAction('close');
    setTxStatus('pending');
    try {
      const res = await closeAuction({ id: auction.id, caller: publicKey });
      if (res.status === 'success') {
        setTxStatus('success');
        setTxHash(res.hash);
        onSuccessToast('Auction settled');
        onUpdated();
      } else {
        setTxStatus('fail');
        setTxHash(res.hash);
        setTxError(friendlyAuctionError(res.error || 'Close failed'));
      }
    } catch (err) {
      setTxStatus('fail');
      setTxError(friendlyAuctionError(err));
    }
  };

  const busy = txStatus === 'pending';
  const currentLabel =
    auction.highestBid > 0
      ? `${formatXlm(auction.highestBid)} XLM`
      : `${formatXlm(auction.startPrice)} XLM (start)`;

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-1">
        <h2 className="font-poppins font-semibold text-[21px] text-[var(--qf-text-1)]">
          {auction.item}
        </h2>
        <span className="text-[11px] font-mono text-[var(--qf-text-4)] flex-shrink-0">
          #{auction.id}
        </span>
      </div>
      <p className="text-[13.5px] text-[var(--qf-text-2)] mb-4 leading-relaxed">
        {auction.description}
      </p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-[var(--qf-input-bg)] border border-[var(--qf-card-border)] rounded-xl p-3">
          <p className="text-[10.5px] uppercase tracking-wider text-[var(--qf-text-4)] mb-1">
            Current
          </p>
          <p className="font-poppins font-semibold text-[17px] text-[var(--qf-text-1)]">
            {currentLabel}
          </p>
          {auction.highestBidder && (
            <p className="mt-1 text-[11px] font-mono text-[var(--qf-text-3)]">
              by {shortAddr(auction.highestBidder)}
            </p>
          )}
        </div>
        <div className="bg-[var(--qf-input-bg)] border border-[var(--qf-card-border)] rounded-xl p-3">
          <p className="text-[10.5px] uppercase tracking-wider text-[var(--qf-text-4)] mb-1">
            Time left
          </p>
          <p className="font-mono text-[17px] font-semibold text-[var(--qf-text-1)]">{label}</p>
          <p className="mt-1 text-[11px] text-[var(--qf-text-3)] capitalize">{status}</p>
        </div>
      </div>

      <p className="text-[12px] text-[var(--qf-text-3)] mb-4 font-mono">
        Seller {shortAddr(auction.seller)}
      </p>

      <TxStatusBanner
        status={txStatus}
        hash={txHash}
        error={txError}
        successLabel={action === 'close' ? 'Auction settled' : 'Bid confirmed'}
        pendingLabel={action === 'close' ? 'Settling auction…' : 'Placing bid…'}
        explorerLink={explorerLink}
        onDismiss={clearTx}
      />

      {fieldError && (
        <p className="mb-3 text-[12.5px] text-[#EF4444]">{fieldError}</p>
      )}

      {canBid && (
        <form onSubmit={handleBid} className="flex flex-col gap-3">
          <div>
            <label className="block mb-1.5 text-[12.5px] text-[var(--qf-text-3)]">
              Your bid (XLM) — min {minBidXlm.toFixed(2)}
            </label>
            <input
              type="text"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              placeholder={minBidXlm.toFixed(2)}
              disabled={busy}
              className="w-full box-border bg-[var(--qf-input-bg)] border border-[var(--qf-input-border)] rounded-xl py-[13px] px-3.5 text-[var(--qf-text-1)] text-[14px] placeholder-[var(--qf-text-4)] focus:outline-none disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            style={primaryBtnStyle}
            className="border-none cursor-pointer font-poppins font-semibold text-[15px] py-[14px] px-5 rounded-full transition-transform hover:scale-[1.02] active:scale-[0.97] disabled:opacity-50"
          >
            {busy && action === 'bid' ? 'Bidding…' : 'Place bid'}
          </button>
        </form>
      )}

      {!publicKey && status === 'live' && (
        <p className="text-[13.5px] text-[var(--qf-text-3)]">Connect a wallet to bid.</p>
      )}

      {isSeller && status === 'live' && (
        <p className="text-[13.5px] text-[var(--qf-text-3)]">
          You are the seller — waiting for bids.
        </p>
      )}

      {canClose && (
        <button
          type="button"
          onClick={handleClose}
          disabled={busy}
          style={primaryBtnStyle}
          className="w-full border-none cursor-pointer font-poppins font-semibold text-[15px] py-[14px] px-5 rounded-full transition-transform hover:scale-[1.02] active:scale-[0.97] disabled:opacity-50"
        >
          {busy && action === 'close'
            ? 'Settling…'
            : auction.highestBidder
              ? 'Close & pay seller'
              : 'Close auction (no bids)'}
        </button>
      )}

      {status === 'settled' && (
        <p className="text-[13.5px] text-[#16A34A] font-medium">
          Settled
          {auction.highestBidder
            ? ` — ${formatXlm(auction.highestBid)} XLM paid to seller`
            : ' — ended with no bids'}
          .
        </p>
      )}
    </div>
  );
}
