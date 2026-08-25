import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MemoryItemRegistry } from '@/lib/registry';
import { reconcileStellarAsNft } from './reconcile';

const meta = (name: string) => ({
  name,
  description: name,
  kind: 'weapon',
});

function asNft(
  registry: MemoryItemRegistry,
  owner: string,
  name: string,
  tokenId: string
) {
  const item = registry.create(owner, meta(name));
  registry.lockForTrade(item.id, owner);
  return registry.markAsNft(item.id, tokenId);
}

describe('reconcileStellarAsNft', () => {
  const owner = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

  it('reverts AsNft when the token does not exist on the current contract', async () => {
    const registry = new MemoryItemRegistry();
    const stale = asNft(registry, owner, 'Old Token Two', '2');
    const live = asNft(registry, owner, 'Mythic Bow', '0');

    const { revertedIds } = await reconcileStellarAsNft({
      registry,
      ownerId: owner,
      views: {
        exists: async (id) => id === '0',
        itemIdOnChain: async (id) => (id === '0' ? live.id : ''),
      },
    });

    assert.deepEqual(revertedIds, [stale.id]);
    assert.equal(registry.get(stale.id)?.state, 'InGame');
    assert.equal(registry.get(stale.id)?.tokenId, undefined);
    assert.equal(registry.get(live.id)?.state, 'AsNft');
    assert.equal(registry.get(live.id)?.tokenId, '0');
  });

  it('reverts the bow whose Registry id does not match get_item_id (shared token 0)', async () => {
    const registry = new MemoryItemRegistry();
    const mythic = asNft(registry, owner, 'Mythic Bow', '0');
    const common = asNft(registry, owner, 'Common Bow', '0');

    const { revertedIds } = await reconcileStellarAsNft({
      registry,
      ownerId: owner,
      views: {
        exists: async () => true,
        itemIdOnChain: async () => mythic.id,
      },
    });

    assert.deepEqual(revertedIds, [common.id]);
    assert.equal(registry.get(mythic.id)?.state, 'AsNft');
    assert.equal(registry.get(common.id)?.state, 'InGame');
  });

  it('reverts mock-style token ids on stellar', async () => {
    const registry = new MemoryItemRegistry();
    const mockish = asNft(registry, owner, 'Mock Leftover', 'mock-nft-abc-1');
    const { revertedIds } = await reconcileStellarAsNft({
      registry,
      ownerId: owner,
      views: {
        exists: async () => {
          throw new Error('should not query chain');
        },
        itemIdOnChain: async () => {
          throw new Error('should not query chain');
        },
      },
    });
    assert.deepEqual(revertedIds, [mockish.id]);
    assert.equal(registry.get(mockish.id)?.state, 'InGame');
  });
});
