import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  IllegalTransitionError,
  InvalidArgumentError,
  ItemNotFoundError,
  LocalStorageItemRegistry,
  MemoryItemRegistry,
  OwnerMismatchError,
  isListable,
  isUsable,
  type Item,
  type ItemMeta,
} from './index';

const META: ItemMeta = {
  name: 'Star Blade',
  description: 'A sharp relic from the outer rim',
  kind: 'weapon',
  attrs: { power: 12 },
};

function createInGame(registry: MemoryItemRegistry, ownerId = 'player-1') {
  return registry.create(ownerId, META);
}

function exportToNft(
  registry: MemoryItemRegistry,
  item: Item,
  ownerId: string,
  tokenId: string
) {
  registry.lockForTrade(item.id, ownerId);
  return registry.markAsNft(item.id, tokenId);
}

describe('isUsable / isListable', () => {
  it('isUsable only when InGame', () => {
    const base: Item = {
      id: 'a',
      ownerId: 'p',
      meta: META,
      state: 'InGame',
      updatedAt: 1,
    };
    assert.equal(isUsable(base), true);
    assert.equal(isUsable({ ...base, state: 'LockedForTrade' }), false);
    assert.equal(isUsable({ ...base, state: 'AsNft', tokenId: 't1' }), false);
  });

  it('isListable only when AsNft with tokenId', () => {
    const asNft: Item = {
      id: 'a',
      ownerId: 'p',
      meta: META,
      state: 'AsNft',
      tokenId: 'tok_1',
      updatedAt: 1,
    };
    assert.equal(isListable(asNft), true);
    assert.equal(isListable({ ...asNft, tokenId: undefined }), false);
    assert.equal(isListable({ ...asNft, tokenId: '' }), false);
    assert.equal(
      isListable({ ...asNft, state: 'InGame', tokenId: undefined }),
      false
    );
    assert.equal(
      isListable({ ...asNft, state: 'LockedForTrade', tokenId: undefined }),
      false
    );
  });
});

describe('MemoryItemRegistry — happy path', () => {
  it('create starts InGame and is usable, not listable', () => {
    const registry = new MemoryItemRegistry({
      idFactory: () => 'item_1',
      now: () => 1000,
    });
    const item = createInGame(registry);

    assert.equal(item.id, 'item_1');
    assert.equal(item.ownerId, 'player-1');
    assert.equal(item.state, 'InGame');
    assert.equal(item.updatedAt, 1000);
    assert.deepEqual(item.meta, META);
    assert.equal(item.tokenId, undefined);
    assert.equal(isUsable(item), true);
    assert.equal(isListable(item), false);
    assert.equal(registry.get('item_1')?.id, 'item_1');
    assert.equal(registry.listByOwner('player-1').length, 1);
    assert.equal(registry.listByOwner('other').length, 0);
  });

  it('full cycle: InGame → Locked → AsNft → InGame', () => {
    let t = 0;
    const registry = new MemoryItemRegistry({
      idFactory: () => 'item_cycle',
      now: () => ++t,
    });
    const created = createInGame(registry);

    const locked = registry.lockForTrade(created.id, 'player-1');
    assert.equal(locked.state, 'LockedForTrade');
    assert.equal(isUsable(locked), false);
    assert.equal(isListable(locked), false);

    const asNft = registry.markAsNft(created.id, 'nft_99');
    assert.equal(asNft.state, 'AsNft');
    assert.equal(asNft.tokenId, 'nft_99');
    assert.equal(isUsable(asNft), false);
    assert.equal(isListable(asNft), true);

    const back = registry.markInGame(created.id);
    assert.equal(back.state, 'InGame');
    assert.equal(back.tokenId, undefined);
    assert.equal(isUsable(back), true);
    assert.equal(isListable(back), false);
  });

  it('unlock returns LockedForTrade → InGame', () => {
    const registry = new MemoryItemRegistry({ idFactory: () => 'item_u' });
    const item = createInGame(registry);
    registry.lockForTrade(item.id, 'player-1');
    const unlocked = registry.unlock(item.id, 'player-1');
    assert.equal(unlocked.state, 'InGame');
    assert.equal(isUsable(unlocked), true);
  });

  it('returns defensive copies from get/listByOwner', () => {
    const registry = new MemoryItemRegistry({ idFactory: () => 'item_copy' });
    const created = createInGame(registry);
    const got = registry.get(created.id)!;
    got.state = 'AsNft';
    got.meta.name = 'mutated';
    got.meta.attrs!.power = 999;

    const again = registry.get(created.id)!;
    assert.equal(again.state, 'InGame');
    assert.equal(again.meta.name, 'Star Blade');
    assert.equal(again.meta.attrs!.power, 12);
  });
});

describe('MemoryItemRegistry — illegal transitions & guards', () => {
  it('throws ItemNotFoundError for unknown ids', () => {
    const registry = new MemoryItemRegistry();
    assert.throws(() => registry.lockForTrade('missing', 'p'), ItemNotFoundError);
    assert.throws(() => registry.unlock('missing', 'p'), ItemNotFoundError);
    assert.throws(() => registry.markAsNft('missing', 't'), ItemNotFoundError);
    assert.throws(() => registry.markInGame('missing'), ItemNotFoundError);
  });

  it('lockForTrade / unlock require matching owner', () => {
    const registry = new MemoryItemRegistry({ idFactory: () => 'item_own' });
    const item = createInGame(registry, 'owner-a');

    assert.throws(
      () => registry.lockForTrade(item.id, 'owner-b'),
      OwnerMismatchError
    );

    registry.lockForTrade(item.id, 'owner-a');
    assert.throws(() => registry.unlock(item.id, 'owner-b'), OwnerMismatchError);
  });

  it('rejects lock unless InGame', () => {
    const registry = new MemoryItemRegistry({ idFactory: () => 'item_lock' });
    const item = createInGame(registry);
    registry.lockForTrade(item.id, 'player-1');

    assert.throws(
      () => registry.lockForTrade(item.id, 'player-1'),
      IllegalTransitionError
    );

    registry.markAsNft(item.id, 'tok');
    assert.throws(
      () => registry.lockForTrade(item.id, 'player-1'),
      IllegalTransitionError
    );
  });

  it('rejects unlock unless LockedForTrade', () => {
    const registry = new MemoryItemRegistry({ idFactory: () => 'item_un' });
    const item = createInGame(registry);

    assert.throws(
      () => registry.unlock(item.id, 'player-1'),
      IllegalTransitionError
    );

    exportToNft(registry, item, 'player-1', 'tok');
    assert.throws(
      () => registry.unlock(item.id, 'player-1'),
      IllegalTransitionError
    );
  });

  it('rejects markAsNft unless LockedForTrade', () => {
    const registry = new MemoryItemRegistry({ idFactory: () => 'item_nft' });
    const item = createInGame(registry);

    assert.throws(
      () => registry.markAsNft(item.id, 'tok'),
      IllegalTransitionError
    );

    exportToNft(registry, item, 'player-1', 'tok');
    assert.throws(
      () => registry.markAsNft(item.id, 'tok2'),
      IllegalTransitionError
    );
  });

  it('rejects markInGame unless AsNft', () => {
    const registry = new MemoryItemRegistry({ idFactory: () => 'item_ig' });
    const item = createInGame(registry);

    assert.throws(() => registry.markInGame(item.id), IllegalTransitionError);

    registry.lockForTrade(item.id, 'player-1');
    assert.throws(() => registry.markInGame(item.id), IllegalTransitionError);
  });

  it('rejects empty tokenId on markAsNft', () => {
    const registry = new MemoryItemRegistry({ idFactory: () => 'item_tok' });
    const item = createInGame(registry);
    registry.lockForTrade(item.id, 'player-1');
    assert.throws(
      () => registry.markAsNft(item.id, ''),
      InvalidArgumentError
    );
  });

  it('rejects incomplete create args', () => {
    const registry = new MemoryItemRegistry();
    assert.throws(() => registry.create('', META), InvalidArgumentError);
    assert.throws(
      () => registry.create('p', { name: '', description: 'd', kind: 'weapon' }),
      InvalidArgumentError
    );
  });
});

describe('LocalStorageItemRegistry', () => {
  it('persists and rehydrates across instances', () => {
    const store = new Map<string, string>();
    const storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => {
        store.set(k, v);
      },
      removeItem: (k) => {
        store.delete(k);
      },
    };

    const a = new LocalStorageItemRegistry({
      storage,
      storageKey: 'test-registry',
      idFactory: () => 'persisted_1',
    });
    const created = a.create('player-1', META);
    a.lockForTrade(created.id, 'player-1');
    a.markAsNft(created.id, 'chain_tok');

    const b = new LocalStorageItemRegistry({
      storage,
      storageKey: 'test-registry',
    });
    const loaded = b.get('persisted_1');
    assert.equal(loaded?.state, 'AsNft');
    assert.equal(loaded?.tokenId, 'chain_tok');
    assert.equal(isListable(loaded!), true);
  });
});
