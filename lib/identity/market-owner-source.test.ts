import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

function src(rel: string): string {
  return readFileSync(rel, 'utf8');
}

describe('market inventory owner = actor (identity 04)', () => {
  it('MarketApp unifies inventoryOwnerId with session actorId', () => {
    const text = src('components/market/MarketApp.tsx');
    assert.match(text, /useWalletSession/);
    assert.match(text, /session\?\.ownerId/);
    assert.match(text, /inventoryOwnerId = actorId/);
    assert.doesNotMatch(text, /inventoryOwnerId = PLAYER_OWNER_ID/);
    assert.doesNotMatch(text, /PLAYER_OWNER_ID/);
    assert.doesNotMatch(text, /from '@\/lib\/wallet'/);
    assert.doesNotMatch(text, /stellar-helper/);
  });

  it('loads “your NFTs” via listableForOwner / listByOwner, not listAll guest filter', () => {
    const app = src('components/market/MarketApp.tsx');
    assert.match(app, /listableForOwner\(registry, inventoryOwnerId\)/);
    assert.match(app, /if \(!inventoryOwnerId\)/);
    assert.doesNotMatch(app, /listAll\(\)/);

    const utils = src('components/market/market-utils.ts');
    assert.match(utils, /listByOwner\(ownerId\)\.filter\(isListable\)/);
    assert.doesNotMatch(
      utils,
      /listAll\(\)[\s\S]*owner ===|listAll\(\)[\s\S]*ownerId ===/
    );
  });

  it('does not ship Demo buy / Demo bid / simulate-offer buttons', () => {
    const app = src('components/market/MarketApp.tsx');
    assert.doesNotMatch(app, /DEMO_BUYER_ID|demoBuyerId|stellar4-demo-buyer/);

    const sale = src('components/market/SaleTab.tsx');
    assert.doesNotMatch(sale, /Demo buy|demoBuyerId/);
    assert.match(sale, /buyer: actorId/);

    const auction = src('components/market/AuctionTab.tsx');
    assert.doesNotMatch(auction, /Demo bid|demoBuyerId/);

    const trade = src('components/market/TradeTab.tsx');
    assert.doesNotMatch(trade, /Simulate buyer|demoBuyerId/);
  });

  it('List buttons stay gated on actorId; boards still load global listings', () => {
    for (const file of [
      'components/market/SaleTab.tsx',
      'components/market/AuctionTab.tsx',
      'components/market/TradeTab.tsx',
    ]) {
      const text = src(file);
      assert.match(text, /disabled=\{busy \|\| !tokenId \|\| !actorId\}/);
      assert.doesNotMatch(text, /\.attrs\b|item\.meta\.attrs|weapon attrs/);
    }
    assert.match(src('components/market/SaleTab.tsx'), /port\.listActive\?\.\(\)/);
    assert.match(src('components/market/TradeTab.tsx'), /port\.listActive\?\.\(\)/);
    assert.match(src('components/market/AuctionTab.tsx'), /listActive/);
  });
});
