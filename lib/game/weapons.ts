/** Weapon kinds, tiers, and ItemMeta helpers for Stellar4. */

export const WEAPON_TYPES = ['sword', 'dagger', 'bow', 'staff', 'spear'] as const;
export type WeaponType = (typeof WEAPON_TYPES)[number];

export const TIERS = ['common', 'uncommon', 'rare', 'mythic', 'legendary'] as const;
export type Tier = (typeof TIERS)[number];

export const ITEM_KIND_WEAPON = 'weapon';
export const ITEM_KIND_CONSUMABLE = 'consumable';
export const CHARM_TYPE = 'power_charm';

/** Tier drop weights (higher = more common). */
export const TIER_WEIGHTS: Record<Tier, number> = {
  common: 45,
  uncommon: 28,
  rare: 16,
  mythic: 8,
  legendary: 3,
};

export const TIER_COLORS: Record<Tier, string> = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  mythic: '#a855f7',
  legendary: '#f59e0b',
};

export const TIER_DAMAGE: Record<Tier, { min: number; max: number }> = {
  common: { min: 4, max: 8 },
  uncommon: { min: 8, max: 14 },
  rare: { min: 14, max: 22 },
  mythic: { min: 22, max: 34 },
  legendary: { min: 34, max: 50 },
};

export const WEAPON_LABELS: Record<WeaponType, string> = {
  sword: 'Sword',
  dagger: 'Dagger',
  bow: 'Bow',
  staff: 'Staff',
  spear: 'Spear',
};

export const WEAPON_DESCRIPTIONS: Record<WeaponType, string> = {
  sword: 'A balanced blade with a sweeping slash.',
  dagger: 'Twin quick stabs that strike in rapid succession.',
  bow: 'Fires an arrow projectile across the field.',
  staff: 'Channels a glowing magic bolt.',
  spear: 'A long thrust that reaches farther than other melee.',
};

/** Attack timing / reach params used by the canvas. */
export interface WeaponAnimParams {
  durationMs: number;
  cooldownMs: number;
  reach: number;
  /** Melee hit box width; bows use projectile instead. */
  hitWidth: number;
  projectile?: boolean;
}

export const WEAPON_ANIM: Record<WeaponType, WeaponAnimParams> = {
  sword: { durationMs: 280, cooldownMs: 420, reach: 52, hitWidth: 48 },
  dagger: { durationMs: 180, cooldownMs: 300, reach: 36, hitWidth: 28 },
  bow: { durationMs: 320, cooldownMs: 520, reach: 0, hitWidth: 0, projectile: true },
  staff: { durationMs: 360, cooldownMs: 560, reach: 0, hitWidth: 0, projectile: true },
  spear: { durationMs: 300, cooldownMs: 480, reach: 78, hitWidth: 36 },
};

export interface WeaponAttrs {
  weaponType: WeaponType;
  tier: Tier;
  damage: number;
}

export interface CharmAttrs {
  charmType: typeof CHARM_TYPE;
  buffMultiplier: number;
  durationMs: number;
}

export function rollDamage(tier: Tier): number {
  const { min, max } = TIER_DAMAGE[tier];
  return Math.floor(min + Math.random() * (max - min + 1));
}

export function buildWeaponMeta(weaponType: WeaponType, tier: Tier, damage?: number): {
  name: string;
  description: string;
  kind: string;
  attrs: Record<string, number | string>;
} {
  const dmg = damage ?? rollDamage(tier);
  const label = WEAPON_LABELS[weaponType];
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
  return {
    name: `${tierLabel} ${label}`,
    description: `${WEAPON_DESCRIPTIONS[weaponType]} Tier: ${tierLabel}. Damage: ${dmg}.`,
    kind: ITEM_KIND_WEAPON,
    attrs: {
      weaponType,
      tier,
      damage: dmg,
    },
  };
}

export function buildCharmMeta(): {
  name: string;
  description: string;
  kind: string;
  attrs: Record<string, number | string>;
} {
  return {
    name: 'Power Charm',
    description: 'Consume to gain +50% damage for 12 seconds.',
    kind: ITEM_KIND_CONSUMABLE,
    attrs: {
      charmType: CHARM_TYPE,
      buffMultiplier: 1.5,
      durationMs: 12_000,
    },
  };
}

export function parseWeaponAttrs(
  attrs?: Record<string, number | string>
): WeaponAttrs | null {
  if (!attrs) return null;
  const weaponType = attrs.weaponType;
  const tier = attrs.tier;
  const damage = attrs.damage;
  if (
    typeof weaponType !== 'string' ||
    !WEAPON_TYPES.includes(weaponType as WeaponType) ||
    typeof tier !== 'string' ||
    !TIERS.includes(tier as Tier) ||
    typeof damage !== 'number'
  ) {
    return null;
  }
  return {
    weaponType: weaponType as WeaponType,
    tier: tier as Tier,
    damage,
  };
}

export function parseCharmAttrs(
  attrs?: Record<string, number | string>
): CharmAttrs | null {
  if (!attrs) return null;
  if (attrs.charmType !== CHARM_TYPE) return null;
  const buffMultiplier =
    typeof attrs.buffMultiplier === 'number' ? attrs.buffMultiplier : 1.5;
  const durationMs =
    typeof attrs.durationMs === 'number' ? attrs.durationMs : 12_000;
  return { charmType: CHARM_TYPE, buffMultiplier, durationMs };
}

export function isWeaponItem(kind: string): boolean {
  return kind === ITEM_KIND_WEAPON;
}

export function isCharmItem(kind: string, attrs?: Record<string, number | string>): boolean {
  return kind === ITEM_KIND_CONSUMABLE && attrs?.charmType === CHARM_TYPE;
}
