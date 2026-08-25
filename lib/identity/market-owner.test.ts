import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MemoryItemRegistry } from '@/lib/registry';
import { GUEST_OWNER_ID, resolveOwnerId } from '@/lib/identity/owner';
import { listableForOwner } from '@/components/market/market-utils';

function fakeG(fill = 'A'): string {
  return `G${fill.repeat(55)}`;
}

describe('market listable owner isolation (identity 04)', () => {
  it('mock session owner is guest', () => {
    const session = resolveOwnerId({ adapter: 'mock', publicKey: null });
    assert.equal(session?.ownerId, GUEST_OWNER_ID);
    assert.equal(session?.ownerId, 'stellar4-player');
  });

  it('stellar disconnected has no inventory owner (empty listable)', () => {
    assert.equal(resolveOwnerId({ adapter: 'stellar', publicKey: null }), null);
    const registry = new MemoryItemRegistry();
    const guestItem = registry.create(GUEST_OWNER_ID, {
      name: 'Guest Blade',
      description: 'stays guest',
      kind: 'weapon',
    });
    registry.lockForTrade(guestItem.id, GUEST_OWNER_ID);
    registry.markAsNft(guestItem.id, '1');
    assert.deepEqual(listableForOwner(registry, ''), []);
  });

  it('queries listByOwner only — guest AsNft is not remapped onto a G…', () => {
    const registry = new MemoryItemRegistry();
    const wallet = fakeG('C');
    const guestItem = registry.create(GUEST_OWNER_ID, {
      name: 'Guest NFT',
      description: 'stays guest',
      kind: 'weapon',
    });
    registry.lockForTrade(guestItem.id, GUEST_OWNER_ID);
    registry.markAsNft(guestItem.id, '10');

    const walletItem = registry.create(wallet, {
      name: 'Wallet NFT',
      description: 'owned by G',
      kind: 'weapon',
    });
    registry.lockForTrade(walletItem.id, wallet);
    registry.markAsNft(walletItem.id, '11');

    const inGame = registry.create(wallet, {
      name: 'Not listable',
      description: 'still InGame',
      kind: 'weapon',
    });

    const guestListable = listableForOwner(registry, GUEST_OWNER_ID);
    assert.equal(guestListable.length, 1);
    assert.equal(guestListable[0].id, guestItem.id);

    const walletListable = listableForOwner(registry, wallet);
    assert.equal(walletListable.length, 1);
    assert.equal(walletListable[0].id, walletItem.id);
    assert.ok(walletListable.every((i) => i.ownerId === wallet));
    assert.ok(!walletListable.some((i) => i.id === guestItem.id));
    assert.ok(!walletListable.some((i) => i.id === inGame.id));
  });

  it('stellar + G… session owner is that wallet, not guest', () => {
    const wallet = fakeG('D');
    const session = resolveOwnerId({ adapter: 'stellar', publicKey: wallet });
    assert.equal(session?.ownerId, wallet);
    assert.notEqual(session?.ownerId, GUEST_OWNER_ID);
  });
});
