'use client';

import { useState } from 'react';
import { isUsable, type Item } from '@/lib/registry';
import type { NftBridge } from '@/lib/ports';
import {
  TIER_COLORS,
  isWeaponItem,
  isCharmItem,
  parseWeaponAttrs,
  getEquippedItemId,
} from '@/lib/game';
import { StateBadge, TierDot } from './StateBadge';
import { ItemDetailModal, type ItemExportAdapter } from './ItemDetailModal';
import { CharmPixelIcon, WeaponPixelIcon } from './PixelIcon';

interface InventoryPanelProps {
  ownerId: string;
  items: Item[];
  equippedId: string | null;
  nftBridge: NftBridge;
  adapter?: ItemExportAdapter;
  onEquip: (id: string) => void;
  onUseCharm: (id: string) => void;
  onChanged: () => void;
}

export function InventoryPanel({
  ownerId,
  items,
  equippedId,
  nftBridge,
  adapter,
  onEquip,
  onUseCharm,
  onChanged,
}: InventoryPanelProps) {
  const [selected, setSelected] = useState<Item | null>(null);

  // Keep selected item fresh from list
  const selectedFresh =
    selected && items.find((i) => i.id === selected.id)
      ? items.find((i) => i.id === selected.id)!
      : selected && selected.id
        ? selected
        : null;

  return (
    <div
      className="rounded-xl border border-[var(--qf-card-border)] p-4"
      style={{ background: 'var(--qf-card-bg)' }}
    >
      <div className="flex items-baseline justify-between mb-3">
        <h2
          className="text-base font-semibold text-[var(--qf-text-1)]"
          style={{ fontFamily: 'var(--font-poppins), sans-serif' }}
        >
          Inventory
        </h2>
        <span className="text-xs text-[var(--qf-text-4)]">
          {items.length} item{items.length === 1 ? '' : 's'}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-[var(--qf-text-3)] py-6 text-center">
          Empty — spin the lottery to get weapons.
        </p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[360px] overflow-y-auto pr-1">
          {items.map((item) => {
            const usable = isUsable(item);
            const weapon = isWeaponItem(item.meta.kind)
              ? parseWeaponAttrs(item.meta.attrs)
              : null;
            const charm = isCharmItem(item.meta.kind, item.meta.attrs);
            const accent = weapon
              ? TIER_COLORS[weapon.tier]
              : charm
                ? '#f472b6'
                : 'var(--qf-text-4)';
            const isEquipped = equippedId === item.id;

            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSelected(item)}
                  className="w-full text-left rounded-lg p-3 border cursor-pointer transition-transform active:scale-[0.99]"
                  style={{
                    background: isEquipped
                      ? `${accent}18`
                      : 'var(--qf-card-bg-soft)',
                    borderColor: isEquipped ? `${accent}66` : 'var(--qf-card-border-soft)',
                    opacity: usable ? 1 : 0.72,
                  }}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className="rounded-md flex items-center justify-center flex-shrink-0"
                      style={{
                        width: 44,
                        height: 44,
                        background: 'var(--qf-input-bg)',
                        border: `1px solid ${accent}44`,
                      }}
                    >
                      {weapon ? (
                        <WeaponPixelIcon
                          weaponType={weapon.weaponType}
                          tier={weapon.tier}
                          size={36}
                        />
                      ) : charm ? (
                        <CharmPixelIcon size={36} />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--qf-text-1)] truncate">
                          {weapon && <TierDot tier={weapon.tier} />}
                          {item.meta.name}
                        </span>
                        <StateBadge state={item.state} />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[var(--qf-text-4)]">
                        <span className="capitalize">
                          {weapon
                            ? `${weapon.damage} dmg`
                            : charm
                              ? 'Consumable'
                              : item.meta.kind}
                        </span>
                        {isEquipped && (
                          <span style={{ color: accent }} className="font-semibold">
                            Equipped
                          </span>
                        )}
                        {!usable && (
                          <span className="text-[var(--qf-text-4)]">Unusable</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selectedFresh && (
        <ItemDetailModal
          ownerId={ownerId}
          item={selectedFresh}
          equippedId={equippedId ?? getEquippedItemId(ownerId)}
          nftBridge={nftBridge}
          adapter={adapter}
          onClose={() => setSelected(null)}
          onChanged={() => {
            onChanged();
          }}
          onEquip={(id) => {
            onEquip(id);
            setSelected(null);
          }}
          onUseCharm={(id) => {
            onUseCharm(id);
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
