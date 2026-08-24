import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { MemoryItemRegistry } from '@/lib/registry';
import { buildCharmMeta, buildWeaponMeta } from './weapons';
import {
  BUFF_STORAGE_KEY,
  CONSUMED_STORAGE_KEY,
  EQUIPPED_STORAGE_KEY,
  PLAYER_OWNER_ID,
  equipWeapon,
  getActiveBuff,
  getEquippedItemId,
  isConsumed,
  setGameRegistry,
  useCharm,
} from './player';

const WALLET_A = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const WALLET_B = 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

function guestKey(prefix: string): string {
  return `${prefix}:${PLAYER_OWNER_ID}`;
}

function walletKey(prefix: string, ownerId: string): string {
  return `${prefix}:${ownerId}`;
}

function installMemoryLocalStorage(): Map<string, string> {
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
  return store;
}

describe('combat session keys are per ownerId', () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = installMemoryLocalStorage();
    setGameRegistry(new MemoryItemRegistry());
  });

  afterEach(() => {
    store.clear();
  });

  it('different owners do not share equipped, buff, or consumed', () => {
    const registry = new MemoryItemRegistry();
    setGameRegistry(registry);

    const weaponA = registry.create(
      WALLET_A,
      buildWeaponMeta('sword', 'common', 10)
    );
    const weaponB = registry.create(
      WALLET_B,
      buildWeaponMeta('dagger', 'rare', 20)
    );
    const charmA = registry.create(WALLET_A, buildCharmMeta());
    const charmB = registry.create(WALLET_B, buildCharmMeta());

    equipWeapon(weaponA.id, WALLET_A);
    equipWeapon(weaponB.id, WALLET_B);
    assert.equal(getEquippedItemId(WALLET_A), weaponA.id);
    assert.equal(getEquippedItemId(WALLET_B), weaponB.id);
    assert.equal(store.get(walletKey(EQUIPPED_STORAGE_KEY, WALLET_A)), weaponA.id);
    assert.equal(store.get(walletKey(EQUIPPED_STORAGE_KEY, WALLET_B)), weaponB.id);
    assert.equal(store.has(EQUIPPED_STORAGE_KEY), false);

    useCharm(charmA.id, WALLET_A);
    assert.equal(isConsumed(charmA.id, WALLET_A), true);
    assert.equal(isConsumed(charmA.id, WALLET_B), false);
    assert.ok(getActiveBuff(WALLET_A));
    assert.equal(getActiveBuff(WALLET_B), null);

    useCharm(charmB.id, WALLET_B);
    assert.equal(isConsumed(charmB.id, WALLET_B), true);
    assert.equal(isConsumed(charmB.id, WALLET_A), false);
    assert.ok(getActiveBuff(WALLET_A));
    assert.ok(getActiveBuff(WALLET_B));
    assert.ok(store.get(walletKey(BUFF_STORAGE_KEY, WALLET_A)));
    assert.ok(store.get(walletKey(BUFF_STORAGE_KEY, WALLET_B)));
    assert.ok(store.get(walletKey(CONSUMED_STORAGE_KEY, WALLET_A)));
    assert.ok(store.get(walletKey(CONSUMED_STORAGE_KEY, WALLET_B)));
    assert.notEqual(
      store.get(walletKey(CONSUMED_STORAGE_KEY, WALLET_A)),
      store.get(walletKey(CONSUMED_STORAGE_KEY, WALLET_B))
    );
  });

  it('unkeyed values migrate to guest only, never to a G… key', () => {
    const equippedId = 'item-from-unkeyed';
    const buff = { multiplier: 1.5, expiresAt: Date.now() + 60_000 };
    const consumed = ['charm-from-unkeyed'];

    store.set(EQUIPPED_STORAGE_KEY, equippedId);
    store.set(BUFF_STORAGE_KEY, JSON.stringify(buff));
    store.set(CONSUMED_STORAGE_KEY, JSON.stringify(consumed));

    // Reading a wallet key must not steal or copy unkeyed guest state.
    assert.equal(getEquippedItemId(WALLET_A), null);
    assert.equal(getActiveBuff(WALLET_A), null);
    assert.equal(isConsumed(consumed[0], WALLET_A), false);
    assert.equal(store.get(EQUIPPED_STORAGE_KEY), equippedId);
    assert.equal(store.has(walletKey(EQUIPPED_STORAGE_KEY, WALLET_A)), false);
    assert.equal(store.has(walletKey(BUFF_STORAGE_KEY, WALLET_A)), false);
    assert.equal(store.has(walletKey(CONSUMED_STORAGE_KEY, WALLET_A)), false);

    // Default owner is guest — migrate then drop unkeyed keys.
    assert.equal(getEquippedItemId(), equippedId);
    assert.equal(store.get(guestKey(EQUIPPED_STORAGE_KEY)), equippedId);
    assert.equal(store.has(EQUIPPED_STORAGE_KEY), false);

    const migratedBuff = getActiveBuff();
    assert.equal(migratedBuff?.multiplier, 1.5);
    assert.equal(store.get(guestKey(BUFF_STORAGE_KEY)), JSON.stringify(buff));
    assert.equal(store.has(BUFF_STORAGE_KEY), false);

    assert.equal(isConsumed(consumed[0]), true);
    assert.equal(store.get(guestKey(CONSUMED_STORAGE_KEY)), JSON.stringify(consumed));
    assert.equal(store.has(CONSUMED_STORAGE_KEY), false);

    assert.equal(getEquippedItemId(WALLET_A), null);
    assert.equal(getActiveBuff(WALLET_A), null);
    assert.equal(isConsumed(consumed[0], WALLET_A), false);
    assert.equal(store.has(walletKey(EQUIPPED_STORAGE_KEY, WALLET_A)), false);
  });

  it('does not overwrite an existing guest key when migrating unkeyed leftover', () => {
    store.set(EQUIPPED_STORAGE_KEY, 'stale-unkeyed');
    store.set(guestKey(EQUIPPED_STORAGE_KEY), 'already-guest');

    assert.equal(getEquippedItemId(), 'already-guest');
    assert.equal(store.get(guestKey(EQUIPPED_STORAGE_KEY)), 'already-guest');
    assert.equal(store.has(EQUIPPED_STORAGE_KEY), false);
  });
});
