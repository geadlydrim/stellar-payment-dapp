'use client';

import { useState } from 'react';
import { isUsable, type Item } from '@/lib/registry';
import {
  TIER_COLORS,
  PLAYER_OWNER_ID,
  cancelExportLock,
  getGameRegistry,
  parseWeaponAttrs,
  parseCharmAttrs,
  isWeaponItem,
  isCharmItem,
  GameActionError,
  unequip,
  getEquippedItemId,
} from '@/lib/game';
import { getMockMarketPorts } from '@/lib/adapters/mock';
import { PortError } from '@/lib/adapters/mock/helpers';
import { StateBadge, TierDot } from './StateBadge';
import { CharmPixelIcon, WeaponPixelIcon } from './PixelIcon';

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
  const [importing, setImporting] = useState(false);
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

  const handleConfirmExport = async () => {
    setError(null);
    setConfirming(true);
    try {
      if (getEquippedItemId() === item.id) unequip();
      const { nftBridge } = getMockMarketPorts(getGameRegistry());
      await nftBridge.exportToNft(item.id, PLAYER_OWNER_ID);
      setShowMintForm(false);
      onChanged();
      onClose();
    } catch (e) {
      setError(
        e instanceof GameActionError || e instanceof PortError
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

  const handleImport = async () => {
    if (!item.tokenId) return;
    setError(null);
    setImporting(true);
    try {
      const { nftBridge } = getMockMarketPorts(getGameRegistry());
      await nftBridge.importFromNft(item.tokenId, PLAYER_OWNER_ID);
      onChanged();
      onClose();
    } catch (e) {
      setError(
        e instanceof PortError || e instanceof Error
          ? e.message
          : 'Import failed'
      );
    } finally {
      setImporting(false);
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
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                width: 56,
                height: 56,
                background: 'var(--qf-input-bg)',
                border: `1px solid ${tierColor}55`,
              }}
            >
              {weapon ? (
                <WeaponPixelIcon
                  weaponType={weapon.weaponType}
                  tier={weapon.tier}
                  size={48}
                />
              ) : charm ? (
                <CharmPixelIcon size={48} />
              ) : null}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {weapon && <TierDot tier={weapon.tier} />}
                <h3
                  className="text-lg font-semibold text-[var(--qf-text-1)] truncate"
                  style={{ fontFamily: 'var(--font-poppins), sans-serif' }}
                >
                  {item.meta.name}
                </h3>
              </div>
              <StateBadge state={item.state} />
            </div>
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

            {item.state === 'AsNft' && item.tokenId && (
              <button
                type="button"
                disabled={importing}
                onClick={() => void handleImport()}
                title="Redeem NFT back to InGame (cancel marketplace listing first if listed)"
                className="py-2 rounded-lg text-sm font-semibold cursor-pointer border border-[var(--qf-card-border)] bg-[var(--qf-card-bg-soft)] text-[var(--qf-text-1)] disabled:opacity-45"
                data-hook="import-from-nft"
              >
                {importing ? 'Importing…' : 'Import from NFT'}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[var(--qf-text-2)]">
              Export locks the item, mints a mock NFT token id, and marks it{' '}
              <code className="text-xs">AsNft</code>. It cannot be used in-game
              until imported. List it on{' '}
              <a href="/market" className="underline text-[var(--qf-text-1)]">
                Marketplace
              </a>
              .
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
                <span className="text-[var(--qf-text-2)]">Mock NftBridge</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--qf-text-4)]">Est. fee</span>
                <span className="text-[var(--qf-text-2)]">— (Soroban later)</span>
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
                onClick={() => void handleConfirmExport()}
                data-hook="export-to-nft-confirm"
                className="flex-1 py-2 rounded-lg text-sm font-semibold border-none cursor-pointer disabled:opacity-50"
                style={{
                  background:
                    'linear-gradient(135deg, var(--qf-accent-1), var(--qf-accent-2))',
                  color: 'var(--qf-accent-ink)',
                }}
              >
                {confirming ? 'Exporting…' : 'Export to NFT'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
