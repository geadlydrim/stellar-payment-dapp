'use client';

import { useState, type CSSProperties } from 'react';
import { createAuction, friendlyAuctionError } from '@/lib/auction';
import type { TxStatus } from '@/lib/soroban';
import { TxStatusBanner } from './TxStatusBanner';

interface CreateAuctionFormProps {
  publicKey: string | null;
  explorerLink: (hash: string) => string;
  onCreated: () => void;
}

export function CreateAuctionForm({
  publicKey,
  explorerLink,
  onCreated,
}: CreateAuctionFormProps) {
  const [item, setItem] = useState('');
  const [description, setDescription] = useState('');
  const [startPrice, setStartPrice] = useState('');
  const [durationMin, setDurationMin] = useState('60');
  const [fieldError, setFieldError] = useState('');
  const [txStatus, setTxStatus] = useState<TxStatus | null>(null);
  const [txHash, setTxHash] = useState('');
  const [txError, setTxError] = useState('');

  const primaryBtnStyle: CSSProperties = {
    background: 'linear-gradient(135deg,var(--qf-accent-1),var(--qf-accent-2))',
    color: 'var(--qf-accent-ink)',
    boxShadow: '0 6px 18px var(--qf-accent-glow)',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError('');
    setTxStatus(null);
    setTxError('');
    setTxHash('');

    if (!publicKey) {
      setFieldError('Connect a wallet to create an auction.');
      return;
    }
    if (!item.trim()) {
      setFieldError('Add an item name.');
      return;
    }
    const price = parseFloat(startPrice);
    if (!startPrice.trim() || isNaN(price) || price <= 0) {
      setFieldError('Start price must be a positive number.');
      return;
    }
    const mins = parseInt(durationMin, 10);
    if (isNaN(mins) || mins < 1) {
      setFieldError('Duration must be at least 1 minute.');
      return;
    }

    setTxStatus('pending');
    try {
      const res = await createAuction({
        seller: publicKey,
        item: item.trim(),
        description: description.trim() || item.trim(),
        startPriceXlm: price,
        durationSec: mins * 60,
      });

      if (res.status === 'success') {
        setTxStatus('success');
        setTxHash(res.hash);
        setItem('');
        setDescription('');
        setStartPrice('');
        onCreated();
      } else {
        setTxStatus('fail');
        setTxHash(res.hash);
        setTxError(friendlyAuctionError(res.error || 'Create failed'));
      }
    } catch (err) {
      setTxStatus('fail');
      setTxError(friendlyAuctionError(err));
    }
  };

  const busy = txStatus === 'pending';

  return (
    <div>
      <h2 className="mt-1 mb-[18px] font-poppins font-semibold text-[21px] text-[var(--qf-text-1)]">
        Create auction
      </h2>

      <TxStatusBanner
        status={txStatus}
        hash={txHash}
        error={txError}
        successLabel="Auction created"
        pendingLabel="Creating auction…"
        explorerLink={explorerLink}
        onDismiss={() => {
          setTxStatus(null);
          setTxHash('');
          setTxError('');
        }}
      />

      {fieldError && (
        <p className="mb-3 text-[12.5px] text-[#EF4444]">{fieldError}</p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div>
          <label className="block mb-1.5 text-[12.5px] text-[var(--qf-text-3)]">Item</label>
          <input
            type="text"
            value={item}
            onChange={(e) => setItem(e.target.value)}
            placeholder="Vintage mechanical watch"
            disabled={busy || !publicKey}
            className="w-full box-border bg-[var(--qf-input-bg)] border border-[var(--qf-input-border)] rounded-xl py-[13px] px-3.5 text-[var(--qf-text-1)] text-[14px] placeholder-[var(--qf-text-4)] focus:outline-none disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block mb-1.5 text-[12.5px] text-[var(--qf-text-3)]">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's special about it?"
            rows={2}
            disabled={busy || !publicKey}
            className="w-full box-border bg-[var(--qf-input-bg)] border border-[var(--qf-input-border)] rounded-xl py-[13px] px-3.5 text-[var(--qf-text-1)] text-[14px] placeholder-[var(--qf-text-4)] focus:outline-none resize-none disabled:opacity-50"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block mb-1.5 text-[12.5px] text-[var(--qf-text-3)]">
              Start price (XLM)
            </label>
            <input
              type="text"
              value={startPrice}
              onChange={(e) => setStartPrice(e.target.value)}
              placeholder="1.0"
              disabled={busy || !publicKey}
              className="w-full box-border bg-[var(--qf-input-bg)] border border-[var(--qf-input-border)] rounded-xl py-[13px] px-3.5 text-[var(--qf-text-1)] text-[14px] placeholder-[var(--qf-text-4)] focus:outline-none disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block mb-1.5 text-[12.5px] text-[var(--qf-text-3)]">
              Duration (min)
            </label>
            <input
              type="number"
              min={1}
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
              disabled={busy || !publicKey}
              className="w-full box-border bg-[var(--qf-input-bg)] border border-[var(--qf-input-border)] rounded-xl py-[13px] px-3.5 text-[var(--qf-text-1)] text-[14px] placeholder-[var(--qf-text-4)] focus:outline-none disabled:opacity-50"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={busy || !publicKey}
          style={primaryBtnStyle}
          className="border-none cursor-pointer font-poppins font-semibold text-[15px] py-[15px] px-5 rounded-full mt-1 transition-transform duration-[220ms] hover:scale-[1.02] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {!publicKey ? 'Connect wallet to create' : busy ? 'Creating…' : 'Create auction'}
        </button>
      </form>
    </div>
  );
}
