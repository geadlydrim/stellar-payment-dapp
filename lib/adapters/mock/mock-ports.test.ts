import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { MemoryItemRegistry, isListable, isUsable } from '@/lib/registry';
import {
  createMockMarketPorts,
  resetMockMarketPorts,
} from '@/lib/adapters/mock';

describe('mock market ports', () => {
  beforeEach(() => {
    resetMockMarketPorts();
  });

  it('export → listable → import demo path', async () => {
    const registry = new MemoryItemRegistry();
    const ports = createMockMarketPorts(registry);
    const owner = 'player-1';

    const item = registry.create(owner, {
      name: 'Test Sword',
      description: 'sharp',
      kind: 'weapon',
    });

    assert.equal(isUsable(item), true);
    const { tokenId } = await ports.nftBridge.exportToNft(item.id, owner);
    const asNft = registry.get(item.id)!;
    assert.equal(asNft.state, 'AsNft');
    assert.equal(asNft.tokenId, tokenId);
    assert.equal(isListable(asNft), true);
    assert.equal(isUsable(asNft), false);

    await ports.fixedPrice.list({
      tokenId,
      seller: owner,
      priceXlm: '10',
    });

    await assert.rejects(
      () => ports.nftBridge.importFromNft(tokenId, owner),
      /listing/
    );

    const active = await ports.fixedPrice.listActive!();
    await ports.fixedPrice.cancel({
      listingId: active[0].listingId,
      seller: owner,
    });

    const { itemId } = await ports.nftBridge.importFromNft(tokenId, owner);
    assert.equal(itemId, item.id);
    const back = registry.get(item.id)!;
    assert.equal(back.state, 'InGame');
    assert.equal(back.tokenId, undefined);
    assert.equal(isUsable(back), true);
  });

  it('sale buy transfers owner; offer board accept/reject', async () => {
    const registry = new MemoryItemRegistry();
    const ports = createMockMarketPorts(registry);
    const seller = 'seller';
    const buyer = 'buyer';

    const a = registry.create(seller, {
      name: 'A',
      description: 'a',
      kind: 'weapon',
    });
    const b = registry.create(buyer, {
      name: 'B',
      description: 'b',
      kind: 'weapon',
    });
    const { tokenId: tokenA } = await ports.nftBridge.exportToNft(a.id, seller);
    const { tokenId: tokenB } = await ports.nftBridge.exportToNft(b.id, buyer);

    const sale = await ports.fixedPrice.list({
      tokenId: tokenA,
      seller,
      priceXlm: '3',
    });
    await ports.fixedPrice.buy({ listingId: sale.listingId, buyer });
    assert.equal(registry.get(a.id)!.ownerId, buyer);

    // buyer lists B for trade; seller offers tokenA (now owned by buyer — use seller's nothing)
    // Re-export path: seller creates C
    const c = registry.create(seller, {
      name: 'C',
      description: 'c',
      kind: 'weapon',
    });
    const { tokenId: tokenC } = await ports.nftBridge.exportToNft(c.id, seller);
    const trade = await ports.offerBoard.listForOffers({
      tokenId: tokenC,
      seller,
      wantsHint: 'want B',
    });

    const offer = await ports.offerBoard.submitOffer({
      listingId: trade.listingId,
      buyer,
      xlm: '0',
      offerTokenIds: [tokenB],
    });

    await ports.offerBoard.rejectOffer({
      offerId: offer.offerId,
      seller,
    });
    assert.equal(
      (await ports.offerBoard.listOffers!(trade.listingId))[0].status,
      'rejected'
    );

    const offer2 = await ports.offerBoard.submitOffer({
      listingId: trade.listingId,
      buyer,
      xlm: '5',
      offerTokenIds: [tokenB],
    });
    await ports.offerBoard.acceptOffer({
      offerId: offer2.offerId,
      seller,
    });
    assert.equal(registry.get(c.id)!.ownerId, buyer);
    assert.equal(registry.get(b.id)!.ownerId, seller);
  });

  it('rejects listing non-listable tokens', async () => {
    const registry = new MemoryItemRegistry();
    const ports = createMockMarketPorts(registry);
    const item = registry.create('p', {
      name: 'X',
      description: 'x',
      kind: 'weapon',
    });
    await assert.rejects(
      () =>
        ports.fixedPrice.list({
          tokenId: 'missing',
          seller: 'p',
          priceXlm: '1',
        }),
      /Couldn't find that NFT/
    );
    registry.lockForTrade(item.id, 'p');
    // still no tokenId
    await assert.rejects(
      () =>
        ports.auction.listNftAuction({
          tokenId: 'nope',
          seller: 'p',
          startPriceXlm: '1',
          durationSec: 60,
        }),
      /Couldn't find that NFT/
    );
  });

  it('close still settles when the registry NFT row is gone', async () => {
    const registry = new MemoryItemRegistry();
    const ports = createMockMarketPorts(registry);
    const owner = 'player-1';
    const item = registry.create(owner, {
      name: 'Orphan Bow',
      description: 'listed then reconciled',
      kind: 'weapon',
    });
    const { tokenId } = await ports.nftBridge.exportToNft(item.id, owner);
    const listed = await ports.auction.listNftAuction({
      tokenId,
      seller: owner,
      startPriceXlm: '1',
      durationSec: 60,
    });
    registry.markInGame(item.id);
    await ports.auction.close!({
      auctionId: listed.auctionId,
      caller: owner,
    });
    const open = await (
      ports.auction as { listAll: () => Promise<{ auctionId: string | number }[]> }
    ).listAll();
    assert.equal(open.length, 0);
  });
});
