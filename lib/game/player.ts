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
/** Unkeyed prefix. Live keys are `${EQUIPPED_STORAGE_KEY}:${ownerId}`. */
export const EQUIPPED_STORAGE_KEY = 'stellar4:equipped-item';
export const BUFF_STORAGE_KEY = 'stellar4:damage-buff';
export const CONSUMED_STORAGE_KEY = 'stellar4:consumed-items';

const REGISTRY_KEY = 'stellar4:item-registry';

let registrySingleton: ItemRegistry | null = null;

function getLocalStorage(): Storage | null {
  try {
    if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
      return null;
    }
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function namespacedKey(prefix: string, ownerId: string): string {
  return `${prefix}:${ownerId}`;
}

/**
 * Copy an unkeyed combat key into the guest namespace once, then remove it.
 * Never copies onto a `G…` (or any non-guest) key.
 */
function migrateUnkeyedPrefix(prefix: string): void {
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    const unkeyed = storage.getItem(prefix);
    if (unkeyed === null) return;
    const guestKey = namespacedKey(prefix, PLAYER_OWNER_ID);
    if (storage.getItem(guestKey) === null) {
      storage.setItem(guestKey, unkeyed);
    }
    storage.removeItem(prefix);
  } catch {
    // ignore quota / private mode
  }
}

/** Lazy one-time migrate of unkeyed equipped/buff/consumed → guest keys only. */
function migrateGuestCombatKeys(ownerId: string): void {
  if (ownerId !== PLAYER_OWNER_ID) return;
  migrateUnkeyedPrefix(EQUIPPED_STORAGE_KEY);
  migrateUnkeyedPrefix(BUFF_STORAGE_KEY);
  migrateUnkeyedPrefix(CONSUMED_STORAGE_KEY);
}

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

export function getEquippedItemId(
  ownerId: string = PLAYER_OWNER_ID
): ItemId | null {
  migrateGuestCombatKeys(ownerId);
  const storage = getLocalStorage();
  if (!storage) return null;
  try {
    return storage.getItem(namespacedKey(EQUIPPED_STORAGE_KEY, ownerId));
  } catch {
    return null;
  }
}

function setEquippedItemId(
  id: ItemId | null,
  ownerId: string = PLAYER_OWNER_ID
): void {
  migrateGuestCombatKeys(ownerId);
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    const key = namespacedKey(EQUIPPED_STORAGE_KEY, ownerId);
    if (id) storage.setItem(key, id);
    else storage.removeItem(key);
  } catch {
    // ignore quota / private mode
  }
}

export interface DamageBuff {
  multiplier: number;
  expiresAt: number;
}

export function getActiveBuff(
  ownerId: string = PLAYER_OWNER_ID
): DamageBuff | null {
  migrateGuestCombatKeys(ownerId);
  const storage = getLocalStorage();
  if (!storage) return null;
  const key = namespacedKey(BUFF_STORAGE_KEY, ownerId);
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DamageBuff;
    if (!parsed?.expiresAt || parsed.expiresAt <= Date.now()) {
      storage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function setActiveBuff(
  buff: DamageBuff | null,
  ownerId: string = PLAYER_OWNER_ID
): void {
  migrateGuestCombatKeys(ownerId);
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    const key = namespacedKey(BUFF_STORAGE_KEY, ownerId);
    if (buff) storage.setItem(key, JSON.stringify(buff));
    else storage.removeItem(key);
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
  const id = getEquippedItemId(ownerId);
  if (!id) return null;
  const item = getGameRegistry().get(id);
  if (!item || item.ownerId !== ownerId || !isUsable(item) || !isWeaponItem(item.meta.kind)) {
    setEquippedItemId(null, ownerId);
    return null;
  }
  const attrs = parseWeaponAttrs(item.meta.attrs);
  if (!attrs) {
    setEquippedItemId(null, ownerId);
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
      "This item isn't in your bag. Bring it back to Play first."
    );
  }
  if (!isWeaponItem(item.meta.kind)) {
    throw new GameActionError('Only weapons can be equipped');
  }
  if (!parseWeaponAttrs(item.meta.attrs)) {
    throw new GameActionError("This weapon can't be equipped.");
  }
  setEquippedItemId(item.id, ownerId);
  return item;
}

export function unequip(ownerId: string = PLAYER_OWNER_ID): void {
  setEquippedItemId(null, ownerId);
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
      "This item isn't in your bag. Bring it back to Play first."
    );
  }
  if (!isCharmItem(item.meta.kind, item.meta.attrs)) {
    throw new GameActionError('Only Power Charms can be used this way');
  }
  const attrs = parseCharmAttrs(item.meta.attrs);
  if (!attrs) throw new GameActionError("This charm can't be used.");

  const buff: DamageBuff = {
    multiplier: attrs.buffMultiplier,
    expiresAt: Date.now() + attrs.durationMs,
  };
  setActiveBuff(buff, ownerId);
  markConsumed(itemId, ownerId);

  return { item, buff, attrs };
}

function markConsumed(
  itemId: ItemId,
  ownerId: string = PLAYER_OWNER_ID
): void {
  migrateGuestCombatKeys(ownerId);
  const storage = getLocalStorage();
  if (!storage) return;
  try {
    const key = namespacedKey(CONSUMED_STORAGE_KEY, ownerId);
    const raw = storage.getItem(key);
    const list: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    if (!list.includes(itemId)) list.push(itemId);
    storage.setItem(key, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function isConsumed(
  itemId: ItemId,
  ownerId: string = PLAYER_OWNER_ID
): boolean {
  migrateGuestCombatKeys(ownerId);
  const storage = getLocalStorage();
  if (!storage) return false;
  try {
    const raw = storage.getItem(namespacedKey(CONSUMED_STORAGE_KEY, ownerId));
    if (!raw) return false;
    return (JSON.parse(raw) as string[]).includes(itemId);
  } catch {
    return false;
  }
}

export function listVisibleInventory(ownerId: string = PLAYER_OWNER_ID): Item[] {
  return listInventory(ownerId).filter((i) => !isConsumed(i.id, ownerId));
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
    throw new GameActionError('This item is already an NFT.');
  }
  if (getEquippedItemId(ownerId) === itemId) setEquippedItemId(null, ownerId);
  return getGameRegistry().lockForTrade(itemId, ownerId);
}

/** Cancel export: LockedForTrade → InGame. */
export function cancelExportLock(
  itemId: ItemId,
  ownerId: string = PLAYER_OWNER_ID
): Item {
  return getGameRegistry().unlock(itemId, ownerId);
}

/** Optional injectables (tests / alternate bridges). PlayShell injects NftBridge into Game UI. */
export type ExportHook = (
  itemId: ItemId,
  ownerId: string
) => Promise<{ tokenId: string }>;

export type ImportHook = (
  tokenId: string,
  ownerId: string
) => Promise<{ itemId: ItemId }>;

/** Effective damage including active buff. */
export function computeDamage(
  base: number,
  ownerId: string = PLAYER_OWNER_ID
): number {
  const buff = getActiveBuff(ownerId);
  if (!buff) return base;
  return Math.round(base * buff.multiplier);
}
