import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { MemoryItemRegistry } from '@/lib/registry';
import {
  findItemByTokenId,
  requireListableOwned,
} from '@/lib/adapters/helpers';

const meta = {
  name: 'Blade',
  description: 'sharp',
  kind: 'weapon',
};

function asNft(
  registry: MemoryItemRegistry,
  ownerId: string,
  tokenId: string,
  updatedAt: number
) {
  const item = registry.create(ownerId, meta);
  registry.lockForTrade(item.id, ownerId);
  registry.markAsNft(item.id, tokenId);
  const all = registry.listAll();
  const idx = all.findIndex((i) => i.id === item.id);
  all[idx] = { ...all[idx], updatedAt };
  registry.replaceAll(all);
  return all[idx];
}

describe('findItemByTokenId with duplicate token ids', () => {
  it('prefers the seller’s row when an older guest row shares tokenId 0', () => {
    const registry = new MemoryItemRegistry();
    const guest = asNft(registry, 'stellar4-player', '0', 1_000);
    const seller = asNft(
      registry,
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      '0',
      2_000
    );

    const found = findItemByTokenId(
      registry,
      '0',
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
    );
    assert.equal(found?.id, seller.id);
    assert.notEqual(found?.id, guest.id);

    const listed = requireListableOwned(
      registry,
      '0',
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
    );
    assert.equal(listed.id, seller.id);
  });

  it('still returns the seller row when it is older than the colliding guest row', () => {
    const registry = new MemoryItemRegistry();
    const seller = asNft(
      registry,
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      '0',
      1_000
    );
    asNft(registry, 'stellar4-player', '0', 9_999);

    const found = findItemByTokenId(
      registry,
      '0',
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'
    );
    assert.equal(found?.id, seller.id);
  });

  it('without preferOwnerId picks the newest updatedAt', () => {
    const registry = new MemoryItemRegistry();
    asNft(registry, 'stellar4-player', '0', 1_000);
    const newer = asNft(
      registry,
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      '0',
      2_000
    );
    const found = findItemByTokenId(registry, '0');
    assert.equal(found?.id, newer.id);
  });
});

describe('stellar listable lookup passes seller into findItemByTokenId', () => {
  it('requireListableChainOwner prefers seller’s registry row', () => {
    const text = readFileSync('lib/adapters/stellar/listable.ts', 'utf8');
    assert.match(text, /findItemByTokenId\(\s*registry,\s*tokenId,\s*seller/);
  });
});
