import {
  LocalStorageItemRegistry,
  isUsable,
  type Item,
  type ItemId,
  type ItemRegistry,
} from '@/lib/registry';
import { rollSpin, type SpinResult } from './lottery';
import {
  isCharmItem,
  isWeaponItem,
  parseCharmAttrs,
  parseWeaponAttrs,
  type CharmAttrs,
  type WeaponAttrs,
} from './weapons';

export const PLAYER_OWNER_ID = 'stellar4-player';
export const EQUIPPED_STORAGE_KEY = 'stellar4:equipped-item';
export const BUFF_STORAGE_KEY = 'stellar4:damage-buff';

const REGISTRY_KEY = 'stellar4:item-registry';

let registrySingleton: ItemRegistry | null = null;

/** Client-side registry singleton (localStorage-backed). SSR-safe. */
export function getGameRegistry(): ItemRegistry {
  if (!registrySingleton) {
    registrySingleton = new LocalStorageItemRegistry({
      storageKey: REGISTRY_KEY,
    });
  }
  return registrySingleton;
}

/** Test / Integration hook: replace the singleton. */
export function setGameRegistry(registry: ItemRegistry): void {
  registrySingleton = registry;
}

export function listInventory(ownerId: string = PLAYER_OWNER_ID): Item[] {
  return getGameRegistry().listByOwner(ownerId);
}

export function getEquippedItemId(): ItemId | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(EQUIPPED_STORAGE_KEY);
  } catch {
    return null;
  }
}

function setEquippedItemId(id: ItemId | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (id) localStorage.setItem(EQUIPPED_STORAGE_KEY, id);
    else localStorage.removeItem(EQUIPPED_STORAGE_KEY);
  } catch {
    // ignore quota / private mode
  }
}

export interface DamageBuff {
  multiplier: number;
  expiresAt: number;
}

export function getActiveBuff(): DamageBuff | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(BUFF_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DamageBuff;
    if (!parsed?.expiresAt || parsed.expiresAt <= Date.now()) {
      localStorage.removeItem(BUFF_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function setActiveBuff(buff: DamageBuff | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (buff) localStorage.setItem(BUFF_STORAGE_KEY, JSON.stringify(buff));
    else localStorage.removeItem(BUFF_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Returns the currently equipped weapon if it is still InGame and owned.
 * Auto-clears the equip slot when the item is locked / exported / missing.
 */
export function getEquippedWeapon(
  ownerId: string = PLAYER_OWNER_ID
): { item: Item; attrs: WeaponAttrs } | null {
  const id = getEquippedItemId();
  if (!id) return null;
  const item = getGameRegistry().get(id);
  if (!item || item.ownerId !== ownerId || !isUsable(item) || !isWeaponItem(item.meta.kind)) {
    setEquippedItemId(null);
    return null;
  }
  const attrs = parseWeaponAttrs(item.meta.attrs);
  if (!attrs) {
    setEquippedItemId(null);
    return null;
  }
  return { item, attrs };
}

export class GameActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameActionError';
  }
}

/** Spin lottery → create item in registry. Pass a pre-rolled result to match the reel. */
export function spinAndAdd(
  ownerId: string = PLAYER_OWNER_ID,
  preRolled?: SpinResult
): { result: SpinResult; item: Item } {
  const result = preRolled ?? rollSpin();
  const item = getGameRegistry().create(ownerId, result.meta);
  return { result, item };
}

/** Equip a weapon. Fails unless isUsable. */
export function equipWeapon(
  itemId: ItemId,
  ownerId: string = PLAYER_OWNER_ID
): Item {
  const item = getGameRegistry().get(itemId);
  if (!item) throw new GameActionError('Item not found');
  if (item.ownerId !== ownerId) throw new GameActionError('Not your item');
  if (!isUsable(item)) {
    throw new GameActionError(
      `Cannot equip: item is ${item.state} (must be InGame)`
    );
  }
  if (!isWeaponItem(item.meta.kind)) {
    throw new GameActionError('Only weapons can be equipped');
  }
  if (!parseWeaponAttrs(item.meta.attrs)) {
    throw new GameActionError('Weapon is missing attrs');
  }
  setEquippedItemId(item.id);
  return item;
}

export function unequip(): void {
  setEquippedItemId(null);
}

/**
 * Consume a Power Charm. Registry has no delete API, so we apply the buff
 * and hide the item via a local consumed-id set (filtered in listVisibleInventory).
 */
export function useCharm(
  itemId: ItemId,
  ownerId: string = PLAYER_OWNER_ID
): { item: Item; buff: DamageBuff; attrs: CharmAttrs } {
  const item = getGameRegistry().get(itemId);
  if (!item) throw new GameActionError('Item not found');
  if (item.ownerId !== ownerId) throw new GameActionError('Not your item');
  if (!isUsable(item)) {
    throw new GameActionError(
      `Cannot use: item is ${item.state} (must be InGame)`
    );
  }
  if (!isCharmItem(item.meta.kind, item.meta.attrs)) {
    throw new GameActionError('Only Power Charms can be used this way');
  }
  const attrs = parseCharmAttrs(item.meta.attrs);
  if (!attrs) throw new GameActionError('Charm is missing attrs');

  const buff: DamageBuff = {
    multiplier: attrs.buffMultiplier,
    expiresAt: Date.now() + attrs.durationMs,
  };
  setActiveBuff(buff);
  markConsumed(itemId);

  return { item, buff, attrs };
}

const CONSUMED_KEY = 'stellar4:consumed-items';

function markConsumed(itemId: ItemId): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(CONSUMED_KEY);
    const list: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    if (!list.includes(itemId)) list.push(itemId);
    localStorage.setItem(CONSUMED_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function isConsumed(itemId: ItemId): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(CONSUMED_KEY);
    if (!raw) return false;
    return (JSON.parse(raw) as string[]).includes(itemId);
  } catch {
    return false;
  }
}

export function listVisibleInventory(ownerId: string = PLAYER_OWNER_ID): Item[] {
  return listInventory(ownerId).filter((i) => !isConsumed(i.id));
}

/**
 * Lock only (LockedForTrade). Prefer NftBridge.exportToNft for full export;
 * kept for cancel/resume flows that stop mid-export.
 */
export function requestExportLock(
  itemId: ItemId,
  ownerId: string = PLAYER_OWNER_ID
): Item {
  const item = getGameRegistry().get(itemId);
  if (!item) throw new GameActionError('Item not found');
  if (item.ownerId !== ownerId) throw new GameActionError('Not your item');
  if (!isUsable(item)) {
    throw new GameActionError(`Cannot export: item is already ${item.state}`);
  }
  if (getEquippedItemId() === itemId) setEquippedItemId(null);
  return getGameRegistry().lockForTrade(itemId, ownerId);
}

/** Cancel export: LockedForTrade → InGame. */
export function cancelExportLock(
  itemId: ItemId,
  ownerId: string = PLAYER_OWNER_ID
): Item {
  return getGameRegistry().unlock(itemId, ownerId);
}

/** Optional injectables (tests / alternate bridges). UI uses getMarketPorts composition root. */
export type ExportHook = (
  itemId: ItemId,
  ownerId: string
) => Promise<{ tokenId: string }>;

export type ImportHook = (
  tokenId: string,
  ownerId: string
) => Promise<{ itemId: ItemId }>;

/** Effective damage including active buff. */
export function computeDamage(base: number): number {
  const buff = getActiveBuff();
  if (!buff) return base;
  return Math.round(base * buff.multiplier);
}
