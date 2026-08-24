'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Item } from '@/lib/registry';
import {
  PLAYER_OWNER_ID,
  listVisibleInventory,
  getEquippedItemId,
  getEquippedWeapon,
  getActiveBuff,
  equipWeapon,
  useCharm as applyCharm,
  computeDamage,
  GameActionError,
  type SpinResult,
} from '@/lib/game';
import { ThemeToggle } from '@/components/ThemeToggle';
import { GameCanvas, type EquippedWeaponView } from './GameCanvas';
import { SpinLottery } from './SpinLottery';
import { InventoryPanel } from './InventoryPanel';

interface PlayAppProps {
  /**
   * Session inventory owner. Guest default is for tests / unwrapped render.
   * PlayShell always passes the resolved session id.
   */
  ownerId?: string;
}

function refreshEquippedView(ownerId: string): EquippedWeaponView | null {
  const eq = getEquippedWeapon(ownerId);
  if (!eq) return null;
  const buff = getActiveBuff(ownerId);
  return {
    weaponType: eq.attrs.weaponType,
    tier: eq.attrs.tier,
    damage: eq.attrs.damage,
    effectiveDamage: computeDamage(eq.attrs.damage, ownerId),
    buffActive: !!buff,
  };
}

export function PlayApp({ ownerId = PLAYER_OWNER_ID }: PlayAppProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [equippedId, setEquippedId] = useState<string | null>(null);
  const [equipped, setEquipped] = useState<EquippedWeaponView | null>(null);
  const [buffEndsAt, setBuffEndsAt] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const reload = useCallback(() => {
    setItems(listVisibleInventory(ownerId));
    setEquippedId(getEquippedItemId(ownerId));
    setEquipped(refreshEquippedView(ownerId));
    const buff = getActiveBuff(ownerId);
    setBuffEndsAt(buff?.expiresAt ?? null);
  }, [ownerId]);

  useEffect(() => {
    reload();
    setHydrated(true);
  }, [reload]);

  // Tick buff expiry so canvas damage updates
  useEffect(() => {
    if (!buffEndsAt) return;
    const remaining = buffEndsAt - Date.now();
    if (remaining <= 0) {
      reload();
      return;
    }
    const t = setTimeout(() => reload(), remaining + 50);
    const interval = setInterval(() => setEquipped(refreshEquippedView(ownerId)), 500);
    return () => {
      clearTimeout(t);
      clearInterval(interval);
    };
  }, [buffEndsAt, ownerId, reload]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = (msg: string) => setToast(msg);

  const handleSpun = useCallback(
    (_item: Item, result: SpinResult) => {
      reload();
      if (result.kind === 'charm') showToast('Power Charm added!');
      else showToast(`${result.meta.name} added!`);
    },
    [reload]
  );

  const handleEquip = (id: string) => {
    try {
      equipWeapon(id, ownerId);
      reload();
      showToast('Weapon equipped');
    } catch (e) {
      showToast(
        e instanceof GameActionError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Equip failed'
      );
    }
  };

  const handleUseCharm = (id: string) => {
    try {
      const { buff } = applyCharm(id, ownerId);
      reload();
      const secs = Math.max(1, Math.round((buff.expiresAt - Date.now()) / 1000));
      showToast(`Power Charm active ×${buff.multiplier} for ${secs}s`);
    } catch (e) {
      showToast(
        e instanceof GameActionError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Use failed'
      );
    }
  };

  const buffSecondsLeft =
    buffEndsAt && buffEndsAt > Date.now()
      ? Math.ceil((buffEndsAt - Date.now()) / 1000)
      : 0;

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
            {buffSecondsLeft > 0 && (
              <span
                className="text-[11px] font-semibold px-2 py-1 rounded-full"
                style={{
                  background: 'rgba(244, 114, 182, 0.2)',
                  color: '#db2777',
                }}
              >
                Buff {buffSecondsLeft}s
              </span>
            )}
            <a
              href="/market"
              className="text-xs font-medium text-[var(--qf-text-2)] no-underline hover:text-[var(--qf-text-1)]"
            >
              Market
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        <section>
          <p className="text-sm text-[var(--qf-text-3)] mb-3">
            Move with <kbd className="px-1 rounded bg-[var(--qf-input-bg)]">A</kbd>{' '}
            / <kbd className="px-1 rounded bg-[var(--qf-input-bg)]">D</kbd>, attack
            with <kbd className="px-1 rounded bg-[var(--qf-input-bg)]">Space</kbd>.
            Spin for weapons, equip, and train on the dummy.
          </p>
          {hydrated ? (
            <GameCanvas equipped={equipped} />
          ) : (
            <div
              className="w-full rounded-xl border border-[var(--qf-card-border)] h-[320px] flex items-center justify-center text-sm text-[var(--qf-text-4)]"
              style={{ background: '#1a2a32' }}
            >
              Loading arena…
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
          <SpinLottery ownerId={ownerId} onSpun={handleSpun} />
          <InventoryPanel
            ownerId={ownerId}
            items={items}
            equippedId={equippedId}
            onEquip={handleEquip}
            onUseCharm={handleUseCharm}
            onChanged={reload}
          />
        </div>
      </main>

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-sm font-medium shadow-lg animate-[qf-toast-in_0.25s_ease]"
          style={{
            background: 'var(--qf-toast-bg)',
            border: '1px solid var(--qf-toast-border)',
            color: 'var(--qf-text-1)',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
