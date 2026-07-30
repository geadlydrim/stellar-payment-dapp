import {
  TIERS,
  TIER_WEIGHTS,
  TIER_COLORS,
  WEAPON_TYPES,
  WEAPON_LABELS,
  buildCharmMeta,
  buildWeaponMeta,
  type Tier,
  type WeaponType,
} from './weapons';
import type { ItemMeta } from '@/lib/registry';

export type SpinResult =
  | { kind: 'weapon'; weaponType: WeaponType; tier: Tier; meta: ItemMeta }
  | { kind: 'charm'; meta: ItemMeta };

/** Chance (0–1) that a spin yields a Power Charm instead of a weapon. */
export const CHARM_DROP_RATE = 0.08;

/** One reel cell: a weapon at a specific rarity color, or the charm. */
export type ReelSlot =
  | {
      kind: 'weapon';
      weaponType: WeaponType;
      tier: Tier;
      label: string;
      color: string;
    }
  | {
      kind: 'charm';
      label: string;
      color: string;
    };

/**
 * Canonical reel order: each of the 5 weapons × 5 rarity colors, then Charm.
 * Index into this array is what the pointer lands on.
 */
export const REEL_SLOTS: readonly ReelSlot[] = [
  ...WEAPON_TYPES.flatMap((weaponType) =>
    TIERS.map(
      (tier): ReelSlot => ({
        kind: 'weapon',
        weaponType,
        tier,
        label: WEAPON_LABELS[weaponType],
        color: TIER_COLORS[tier],
      })
    )
  ),
  {
    kind: 'charm',
    label: 'Charm',
    color: '#f472b6',
  },
];

export const CHARM_REEL_INDEX = REEL_SLOTS.length - 1;

export function reelIndexForWeapon(weaponType: WeaponType, tier: Tier): number {
  const wi = WEAPON_TYPES.indexOf(weaponType);
  const ti = TIERS.indexOf(tier);
  if (wi < 0 || ti < 0) return 0;
  return wi * TIERS.length + ti;
}

export function reelIndexForResult(result: SpinResult): number {
  if (result.kind === 'charm') return CHARM_REEL_INDEX;
  return reelIndexForWeapon(result.weaponType, result.tier);
}

function pickWeighted<T extends string>(
  items: readonly T[],
  weights: Record<T, number>,
  rng: () => number
): T {
  let total = 0;
  for (const item of items) total += weights[item];
  let roll = rng() * total;
  for (const item of items) {
    roll -= weights[item];
    if (roll <= 0) return item;
  }
  return items[items.length - 1]!;
}

function pickUniform<T>(items: readonly T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length)]!;
}

/**
 * Roll a random spin result. Unlimited spins; charms drop occasionally.
 * Pass `rng` for deterministic tests (defaults to Math.random).
 */
export function rollSpin(rng: () => number = Math.random): SpinResult {
  if (rng() < CHARM_DROP_RATE) {
    return { kind: 'charm', meta: buildCharmMeta() };
  }
  const weaponType = pickUniform(WEAPON_TYPES, rng);
  const tier = pickWeighted(TIERS, TIER_WEIGHTS, rng);
  return {
    kind: 'weapon',
    weaponType,
    tier,
    meta: buildWeaponMeta(weaponType, tier),
  };
}

/** Build a SpinResult for a known reel slot (used when awarding after land). */
export function spinResultFromSlot(slot: ReelSlot): SpinResult {
  if (slot.kind === 'charm') {
    return { kind: 'charm', meta: buildCharmMeta() };
  }
  return {
    kind: 'weapon',
    weaponType: slot.weaponType,
    tier: slot.tier,
    meta: buildWeaponMeta(slot.weaponType, slot.tier),
  };
}
