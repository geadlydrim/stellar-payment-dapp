'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Item } from '@/lib/registry';
import {
  REEL_SLOTS,
  TIER_COLORS,
  TIERS,
  WEAPON_LABELS,
  rollSpin,
  reelIndexForResult,
  spinAndAdd,
  type SpinResult,
  type Tier,
  type WeaponType,
} from '@/lib/game';

interface SpinLotteryProps {
  onSpun: (item: Item, result: SpinResult) => void;
}

const CELL_W = 88;
const GAP = 8;
const STRIDE = CELL_W + GAP;
/** Extra full reel loops before landing. */
const MIN_LOOPS = 5;
const SPIN_MS = 3200;
const STRIP_COPIES = 18;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Pixel translate so slot `absoluteIndex` is centered in a viewport of `viewW`. */
function translateForIndex(absoluteIndex: number, viewW: number): number {
  const centerPad = viewW / 2 - CELL_W / 2;
  return centerPad - absoluteIndex * STRIDE;
}

export function SpinLottery({ onSpun }: SpinLotteryProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewW, setViewW] = useState(280);
  const [spinning, setSpinning] = useState(false);
  const [translateX, setTranslateX] = useState(0);
  /** Absolute strip index currently under the pointer (grows each spin). */
  const absIndexRef = useRef(0);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<number | null>(null);

  // Measure viewport; keep pointer-aligned when size changes.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const apply = () => {
      const w = el.clientWidth || 280;
      setViewW(w);
      setTranslateX(translateForIndex(absIndexRef.current, w));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const spin = useCallback(() => {
    if (spinning) return;
    setError(null);
    setResult(null);
    setHighlight(null);
    setSpinning(true);

    // Pre-roll so the award matches where the pointer stops.
    const rolled = rollSpin();
    const targetSlot = reelIndexForResult(rolled);
    const N = REEL_SLOTS.length;
    const from = absIndexRef.current;
    const fromSlot = ((from % N) + N) % N;
    let delta = (targetSlot - fromSlot + N) % N;
    if (delta === 0) delta = N; // always travel at least one full reel
    const loops = MIN_LOOPS + Math.floor(Math.random() * 2);
    const to = from + loops * N + delta;

    const startX = translateForIndex(from, viewW);
    const endX = translateForIndex(to, viewW);
    const start = performance.now();

    let raf = 0;
    const animate = (now: number) => {
      const t = Math.min(1, (now - start) / SPIN_MS);
      const x = startX + (endX - startX) * easeOutCubic(t);
      setTranslateX(x);
      if (t < 1) {
        raf = requestAnimationFrame(animate);
        return;
      }

      absIndexRef.current = to;
      setTranslateX(endX);
      setHighlight(targetSlot);

      try {
        const { result: spun, item } = spinAndAdd(undefined, rolled);
        setResult(spun);
        onSpun(item, spun);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Spin failed');
      }
      setSpinning(false);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [spinning, viewW, onSpun]);

  const strip = Array.from({ length: STRIP_COPIES }, () => REEL_SLOTS).flat();

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
          Weapon Spin
        </h2>
        <span className="text-xs text-[var(--qf-text-4)]">Unlimited</span>
      </div>

      {/* Rarity legend */}
      <div className="flex flex-wrap gap-x-2 gap-y-1 mb-2">
        {TIERS.map((tier) => (
          <span
            key={tier}
            className="inline-flex items-center gap-1 text-[10px] capitalize text-[var(--qf-text-3)]"
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: TIER_COLORS[tier] }}
            />
            {tier}
          </span>
        ))}
      </div>

      <div
        ref={viewportRef}
        className="relative overflow-hidden rounded-lg h-[72px] mb-3 border border-[var(--qf-card-border-soft)]"
        style={{ background: 'var(--qf-input-bg)' }}
      >
        {/* Center pointer */}
        <div
          className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center"
          aria-hidden
        >
          <div
            className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent"
            style={{ borderTopColor: 'var(--qf-accent-2)' }}
          />
          <div
            className="flex-1 w-0.5"
            style={{ background: 'var(--qf-accent-2)', opacity: 0.85 }}
          />
          <div
            className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[8px] border-l-transparent border-r-transparent"
            style={{ borderBottomColor: 'var(--qf-accent-2)' }}
          />
        </div>

        {/* Edge fades */}
        <div
          className="absolute inset-y-0 left-0 w-8 z-10 pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, var(--qf-input-bg), transparent)',
          }}
        />
        <div
          className="absolute inset-y-0 right-0 w-8 z-10 pointer-events-none"
          style={{
            background:
              'linear-gradient(270deg, var(--qf-input-bg), transparent)',
          }}
        />

        <div
          className="absolute inset-y-0 flex items-center will-change-transform"
          style={{ transform: `translate3d(${translateX}px, 0, 0)` }}
        >
          {strip.map((slot, i) => {
            const isWinner =
              !spinning && highlight !== null && i === absIndexRef.current;

            return (
              <div
                key={`${slot.kind}-${i}`}
                className="flex-shrink-0 flex flex-col items-center justify-center rounded-md text-center"
                style={{
                  width: CELL_W,
                  height: 56,
                  marginRight: GAP,
                  background: `${slot.color}${isWinner ? '33' : '18'}`,
                  color: slot.color,
                  border: `2px solid ${slot.color}${isWinner ? 'cc' : '66'}`,
                  boxShadow: isWinner ? `0 0 12px ${slot.color}66` : undefined,
                  transform: isWinner ? 'scale(1.04)' : undefined,
                  transition: 'box-shadow 0.2s, transform 0.2s',
                }}
              >
                <span className="text-[11px] font-bold leading-tight">
                  {slot.label}
                </span>
                <span
                  className="text-[9px] font-semibold uppercase tracking-wide opacity-90 leading-tight mt-0.5"
                  style={{ color: slot.color }}
                >
                  {slot.kind === 'weapon' ? slot.tier : 'bonus'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[10px] text-[var(--qf-text-4)] mb-2 text-center">
        5 weapons × 5 rarities — you get whatever the pointer stops on
      </p>

      <button
        type="button"
        onClick={spin}
        disabled={spinning}
        className="w-full py-2.5 rounded-lg text-sm font-semibold cursor-pointer border-none disabled:opacity-60 disabled:cursor-wait transition-transform active:scale-[0.98]"
        style={{
          background:
            'linear-gradient(135deg, var(--qf-accent-1), var(--qf-accent-2))',
          color: 'var(--qf-accent-ink)',
        }}
      >
        {spinning ? 'Spinning…' : 'Spin'}
      </button>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      {result && !spinning && <ResultCard result={result} />}
    </div>
  );
}

function ResultCard({ result }: { result: SpinResult }) {
  if (result.kind === 'charm') {
    return (
      <div
        className="mt-3 rounded-lg p-3 border animate-[qf-fadeup_0.35s_ease]"
        style={{
          background: 'rgba(244, 114, 182, 0.12)',
          borderColor: 'rgba(244, 114, 182, 0.35)',
        }}
      >
        <p className="text-sm font-semibold text-[var(--qf-text-1)]">
          Power Charm!
        </p>
        <p className="text-xs text-[var(--qf-text-3)] mt-0.5">
          Added to inventory — use it for a damage buff.
        </p>
      </div>
    );
  }

  const tier = result.tier as Tier;
  const color = TIER_COLORS[tier];
  return (
    <div
      className="mt-3 rounded-lg p-3 border animate-[qf-fadeup_0.35s_ease]"
      style={{
        background: `${color}18`,
        borderColor: `${color}55`,
      }}
    >
      <p className="text-sm font-semibold text-[var(--qf-text-1)]">
        <span style={{ color }} className="capitalize">
          {tier}
        </span>{' '}
        {WEAPON_LABELS[result.weaponType as WeaponType]}
      </p>
      <p className="text-xs text-[var(--qf-text-3)] mt-0.5">
        {result.meta.description}
      </p>
    </div>
  );
}
