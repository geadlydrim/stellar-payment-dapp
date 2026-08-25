import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it, beforeEach } from 'node:test';
import { MemoryItemRegistry, type Item } from '@/lib/registry';
import {
  createMockMarketPorts,
  resetMockMarketPorts,
} from '@/lib/adapters/mock';
import {
  availableToList,
  collectListedTokenIds,
  listableForOwner,
  listingSelectEmptyLabel,
  loadListedTokenIds,
} from './market-utils';

function asNft(registry: MemoryItemRegistry, owner: string, name: string, tokenId: string): Item {
  const item = registry.create(owner, {
    name,
    description: name,
    kind: 'weapon',
  });
  registry.lockForTrade(item.id, owner);
  return registry.markAsNft(item.id, tokenId);
}

describe('collectListedTokenIds / availableToList', () => {
  it('unions token ids from sale, auction, and trade rows', () => {
    const ids = collectListedTokenIds([
      [{ tokenId: '1' }, { tokenId: '2' }],
      [{ tokenId: '2' }, { tokenId: '3' }],
      [{ tokenId: '4' }],
    ]);
    assert.deepEqual([...ids].sort(), ['1', '2', '3', '4']);
  });

  it('ignores empty groups', () => {
    const ids = collectListedTokenIds([undefined, null, []]);
    assert.equal(ids.size, 0);
  });

  it('drops listed NFTs from the owner listable set', () => {
    const registry = new MemoryItemRegistry();
    const owner = 'player-1';
    asNft(registry, owner, 'Listed Sword', '10');
    asNft(registry, owner, 'Free Spear', '11');
    const owned = listableForOwner(registry, owner);
    assert.equal(owned.length, 2);
    const available = availableToList(owned, new Set(['10']));
    assert.equal(available.length, 1);
    assert.equal(available[0]!.tokenId, '11');
    assert.equal(available[0]!.meta.name, 'Free Spear');
  });

  it('empty-select copy distinguishes never-exported vs already listed', () => {
    assert.equal(
      listingSelectEmptyLabel({ ownedListable: 0, available: 0 }),
      'Export one from Play first'
    );
    assert.equal(
      listingSelectEmptyLabel({ ownedListable: 2, available: 0 }),
      'All of your NFTs are already listed — cancel one first'
    );
    assert.equal(
      listingSelectEmptyLabel({
        ownedListable: 1,
        available: 0,
        kind: 'offer',
      }),
      'All spare NFTs are listed — cancel one first'
    );
  });

  it('loadListedTokenIds prefers auction listAll (unsettled) over listActive', async () => {
    const ids = await loadListedTokenIds({
      fixedPrice: {
        listActive: async () => [{ tokenId: 'sale-1' }],
      },
      auction: {
        listActive: async () => [{ tokenId: 'auc-active' }],
        listAll: async () => [{ tokenId: 'auc-ended-open' }],
      },
      offerBoard: {
        listActive: async () => [{ tokenId: 'trade-1' }],
      },
    });
    assert.equal(ids.has('sale-1'), true);
    assert.equal(ids.has('trade-1'), true);
    assert.equal(ids.has('auc-ended-open'), true);
    assert.equal(ids.has('auc-active'), false);
  });

  it('sale listing hides that NFT from auction/trade availableToList (mock ports)', async () => {
    resetMockMarketPorts();
    const registry = new MemoryItemRegistry();
    const ports = createMockMarketPorts(registry);
    const owner = 'player-1';
    const listed = asNft(registry, owner, 'On Sale', 'tok-sale');
    const free = asNft(registry, owner, 'Free', 'tok-free');
    await ports.fixedPrice.list({
      tokenId: listed.tokenId!,
      seller: owner,
      priceXlm: '5',
    });
    const busy = await loadListedTokenIds(ports);
    const available = availableToList(listableForOwner(registry, owner), busy);
    assert.equal(busy.has('tok-sale'), true);
    assert.equal(available.map((i) => i.tokenId).sort().join(','), 'tok-free');
    assert.equal(free.tokenId, 'tok-free');
  });
});

describe('market tabs hide listed tokens from TokenSelect (source)', () => {
  it('Sale / Auction / Trade use availableToList; MarketApp loads listed ids', () => {
    const sale = readFileSync('components/market/SaleTab.tsx', 'utf8');
    const auction = readFileSync('components/market/AuctionTab.tsx', 'utf8');
    const trade = readFileSync('components/market/TradeTab.tsx', 'utf8');
    const app = readFileSync('components/market/MarketApp.tsx', 'utf8');
    for (const src of [sale, auction, trade]) {
      assert.match(src, /availableToList/);
      assert.match(src, /listedTokenIds/);
    }
    assert.match(app, /loadListedTokenIds/);
    assert.match(app, /listedTokenIds=\{listedTokenIds\}/);
    const select = readFileSync('components/market/TokenSelect.tsx', 'utf8');
    assert.match(select, /value=\{item\.id\}/);
    assert.doesNotMatch(select, /value=\{item\.tokenId!\}/);
    const auctionTab = readFileSync('components/market/AuctionTab.tsx', 'utf8');
    assert.match(auctionTab, /port\.close && ended/);
    assert.doesNotMatch(auctionTab, /ended \|\| mine/);
    assert.doesNotMatch(sale, /Demo buy|demoBuyerId/);
    assert.doesNotMatch(auction, /Demo bid|demoBuyerId/);
    assert.doesNotMatch(trade, /Simulate buyer|demoBuyerId/);
    assert.doesNotMatch(app, /DEMO_BUYER_ID|demoBuyerId/);
  });
});
