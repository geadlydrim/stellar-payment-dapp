'use client';

import { useState } from 'react';
import { isUsable, type Item } from '@/lib/registry';
import {
  TIER_COLORS,
  cancelExportLock,
  requestExportLock,
  parseWeaponAttrs,
  parseCharmAttrs,
  isWeaponItem,
  isCharmItem,
  GameActionError,
} from '@/lib/game';
import { StateBadge, TierDot } from './StateBadge';

interface ItemDetailModalProps {
  item: Item;
  equippedId: string | null;
  onClose: () => void;
  onChanged: () => void;
  onEquip: (id: string) => void;
  onUseCharm: (id: string) => void;
}

export function ItemDetailModal({
  item,
  equippedId,
  onClose,
  onChanged,
  onEquip,
  onUseCharm,
}: ItemDetailModalProps) {
  const [showMintForm, setShowMintForm] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(item.meta.name);
  const [notes, setNotes] = useState('');

  const usable = isUsable(item);
  const weapon = isWeaponItem(item.meta.kind)
    ? parseWeaponAttrs(item.meta.attrs)
    : null;
  const charm = isCharmItem(item.meta.kind, item.meta.attrs)
    ? parseCharmAttrs(item.meta.attrs)
    : null;
  const tierColor = weapon ? TIER_COLORS[weapon.tier] : '#f472b6';

  const handleConfirmExport = () => {
    setError(null);
    setConfirming(true);
    try {
      requestExportLock(item.id);
      setShowMintForm(false);
      onChanged();
      onClose();
    } catch (e) {
      setError(
        e instanceof GameActionError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Export failed'
      );
    } finally {
      setConfirming(false);
    }
  };

  const handleCancelExport = () => {
    setError(null);
    try {
      cancelExportLock(item.id);
      onChanged();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unlock failed');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10, 16, 20, 0.55)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--qf-card-border)] p-5 shadow-xl animate-[qf-fadeup_0.25s_ease]"
        style={{ background: 'var(--qf-bg-1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {weapon && <TierDot tier={weapon.tier} />}
              <h3
                className="text-lg font-semibold text-[var(--qf-text-1)]"
                style={{ fontFamily: 'var(--font-poppins), sans-serif' }}
              >
                {item.meta.name}
              </h3>
            </div>
            <StateBadge state={item.state} />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--qf-text-3)] hover:text-[var(--qf-text-1)] bg-transparent border-none cursor-pointer text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <p className="text-sm text-[var(--qf-text-3)] mb-4">
          {item.meta.description}
        </p>

        <dl className="grid grid-cols-2 gap-2 text-xs mb-4">
          <div
            className="rounded-lg p-2"
            style={{ background: 'var(--qf-input-bg)' }}
          >
            <dt className="text-[var(--qf-text-4)]">Kind</dt>
            <dd className="text-[var(--qf-text-1)] font-medium capitalize">
              {item.meta.kind}
            </dd>
          </div>
          {weapon && (
            <>
              <div
                className="rounded-lg p-2"
                style={{ background: 'var(--qf-input-bg)' }}
              >
                <dt className="text-[var(--qf-text-4)]">Tier</dt>
                <dd className="font-medium capitalize" style={{ color: tierColor }}>
                  {weapon.tier}
                </dd>
              </div>
              <div
                className="rounded-lg p-2"
                style={{ background: 'var(--qf-input-bg)' }}
              >
                <dt className="text-[var(--qf-text-4)]">Damage</dt>
                <dd className="text-[var(--qf-text-1)] font-medium">
                  {weapon.damage}
                </dd>
              </div>
              <div
                className="rounded-lg p-2"
                style={{ background: 'var(--qf-input-bg)' }}
              >
                <dt className="text-[var(--qf-text-4)]">Type</dt>
                <dd className="text-[var(--qf-text-1)] font-medium capitalize">
                  {weapon.weaponType}
                </dd>
              </div>
            </>
          )}
          {charm && (
            <>
              <div
                className="rounded-lg p-2"
                style={{ background: 'var(--qf-input-bg)' }}
              >
                <dt className="text-[var(--qf-text-4)]">Buff</dt>
                <dd className="text-[var(--qf-text-1)] font-medium">
                  ×{charm.buffMultiplier}
                </dd>
              </div>
              <div
                className="rounded-lg p-2"
                style={{ background: 'var(--qf-input-bg)' }}
              >
                <dt className="text-[var(--qf-text-4)]">Duration</dt>
                <dd className="text-[var(--qf-text-1)] font-medium">
                  {Math.round(charm.durationMs / 1000)}s
                </dd>
              </div>
            </>
          )}
          {item.tokenId && (
            <div
              className="rounded-lg p-2 col-span-2"
              style={{ background: 'var(--qf-input-bg)' }}
            >
              <dt className="text-[var(--qf-text-4)]">Token ID</dt>
              <dd className="text-[var(--qf-text-1)] font-mono text-[11px] break-all">
                {item.tokenId}
              </dd>
            </div>
          )}
          <div
            className="rounded-lg p-2 col-span-2"
            style={{ background: 'var(--qf-input-bg)' }}
          >
            <dt className="text-[var(--qf-text-4)]">Item ID</dt>
            <dd className="text-[var(--qf-text-2)] font-mono text-[11px] break-all">
              {item.id}
            </dd>
          </div>
        </dl>

        {error && (
          <p className="text-xs text-red-500 mb-3">{error}</p>
        )}

        {!showMintForm ? (
          <div className="flex flex-col gap-2">
            {weapon && (
              <button
                type="button"
                disabled={!usable}
                onClick={() => onEquip(item.id)}
                title={
                  usable
                    ? 'Equip for combat'
                    : `Cannot equip while ${item.state}`
                }
                className="py-2 rounded-lg text-sm font-semibold border-none cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                style={{
                  background:
                    equippedId === item.id
                      ? 'var(--qf-secondary)'
                      : 'linear-gradient(135deg, var(--qf-accent-1), var(--qf-accent-2))',
                  color: 'var(--qf-accent-ink)',
                }}
              >
                {equippedId === item.id ? 'Equipped' : 'Equip'}
              </button>
            )}

            {charm && (
              <button
                type="button"
                disabled={!usable}
                onClick={() => onUseCharm(item.id)}
                title={
                  usable ? 'Consume for damage buff' : `Cannot use while ${item.state}`
                }
                className="py-2 rounded-lg text-sm font-semibold border-none cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, #f9a8d4, #f472b6)',
                  color: '#4a0420',
                }}
              >
                Use Charm
              </button>
            )}

            {item.state === 'InGame' && (
              <button
                type="button"
                onClick={() => setShowMintForm(true)}
                className="py-2 rounded-lg text-sm font-semibold cursor-pointer border border-[var(--qf-card-border)] bg-[var(--qf-card-bg-soft)] text-[var(--qf-text-1)]"
              >
                Convert to NFT
              </button>
            )}

            {item.state === 'LockedForTrade' && (
              <button
                type="button"
                onClick={handleCancelExport}
                className="py-2 rounded-lg text-sm font-semibold cursor-pointer border border-[var(--qf-card-border)] bg-[var(--qf-card-bg-soft)] text-[var(--qf-text-1)]"
              >
                Cancel export (unlock)
              </button>
            )}

            {/* Integration hook: wire NftBridge.importFromNft */}
            <button
              type="button"
              disabled
              title="Integration will wire Import via NftBridge"
              className="py-2 rounded-lg text-sm font-medium cursor-not-allowed opacity-45 border border-dashed border-[var(--qf-card-border)] bg-transparent text-[var(--qf-text-3)]"
              data-hook="import-from-nft"
            >
              Import from NFT (soon)
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[var(--qf-text-2)]">
              Review details before locking for mint. On-chain mint is wired later
              by Integration — confirming will lock the item (
              <code className="text-xs">LockedForTrade</code>) so it cannot be used
              in-game.
            </p>

            <label className="block text-xs text-[var(--qf-text-3)]">
              Display name
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 w-full rounded-lg px-3 py-2 text-sm border border-[var(--qf-input-border)] bg-[var(--qf-input-bg)] text-[var(--qf-text-1)] outline-none"
              />
            </label>

            <label className="block text-xs text-[var(--qf-text-3)]">
              Notes (optional)
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg px-3 py-2 text-sm border border-[var(--qf-input-border)] bg-[var(--qf-input-bg)] text-[var(--qf-text-1)] outline-none resize-none"
                placeholder="Shown on marketplace later"
              />
            </label>

            <div
              className="rounded-lg p-3 text-xs space-y-1"
              style={{ background: 'var(--qf-input-bg)' }}
            >
              <div className="flex justify-between">
                <span className="text-[var(--qf-text-4)]">Network</span>
                <span className="text-[var(--qf-text-2)]">Stellar Testnet (mock)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--qf-text-4)]">Est. fee</span>
                <span className="text-[var(--qf-text-2)]">— (backend later)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--qf-text-4)]">Kind / attrs</span>
                <span className="text-[var(--qf-text-2)] capitalize">
                  {item.meta.kind}
                  {weapon ? ` · ${weapon.tier} · ${weapon.damage} dmg` : ''}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowMintForm(false)}
                className="flex-1 py-2 rounded-lg text-sm cursor-pointer border border-[var(--qf-card-border)] bg-transparent text-[var(--qf-text-2)]"
              >
                Back
              </button>
              <button
                type="button"
                disabled={confirming || !displayName.trim()}
                onClick={handleConfirmExport}
                data-hook="export-to-nft-confirm"
                className="flex-1 py-2 rounded-lg text-sm font-semibold border-none cursor-pointer disabled:opacity-50"
                style={{
                  background:
                    'linear-gradient(135deg, var(--qf-accent-1), var(--qf-accent-2))',
                  color: 'var(--qf-accent-ink)',
                }}
              >
                {confirming ? 'Locking…' : 'Confirm lock'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
