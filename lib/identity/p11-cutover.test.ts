import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

function src(rel: string): string {
  return readFileSync(rel, 'utf8');
}

function walkTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) out.push(...walkTs(p));
    else if (
      (name.name.endsWith('.ts') || name.name.endsWith('.tsx')) &&
      !name.name.endsWith('.test.ts') &&
      !name.name.endsWith('.test.tsx')
    ) {
      out.push(p);
    }
  }
  return out;
}

const PRODUCT_UI = [
  'app/page.tsx',
  'app/layout.tsx',
  'components/LandingPage.tsx',
  'components/market/AuctionTab.tsx',
  'components/market/MarketApp.tsx',
  'components/identity/PlayShell.tsx',
];

describe('P11 one kit + landing IA', () => {
  it('only lib/wallet.ts constructs StellarWalletsKit', () => {
    const files = [
      ...walkTs('lib'),
      ...walkTs('components'),
      ...walkTs('app'),
    ];
    const constructors = files.filter((file) =>
      src(file).includes('new StellarWalletsKit')
    );
    assert.deepEqual(constructors, ['lib/wallet.ts']);
  });

  it('legacy XLM auction UI and helpers are gone', () => {
    assert.equal(existsSync('app/legacy/page.tsx'), false);
    assert.equal(existsSync('components/AuctionApp.tsx'), false);
    assert.equal(existsSync('lib/auction.ts'), false);
    assert.equal(existsSync('lib/stellar-helper.ts'), false);
    assert.equal(existsSync('components/auction/AuctionCard.tsx'), false);
  });

  it('/ is Play vs Market landing with no /legacy', () => {
    const home = src('app/page.tsx');
    assert.match(home, /LandingPage/);
    assert.doesNotMatch(home, /AuctionApp/);

    const landing = src('components/LandingPage.tsx');
    assert.match(landing, /data-hook="landing-play"/);
    assert.match(landing, /data-hook="landing-market"/);
    assert.match(landing, /href="\/play"/);
    assert.match(landing, /href="\/market"/);
    assert.doesNotMatch(landing, /\/legacy/);
    assert.doesNotMatch(landing, /AuctionApp/);
    assert.doesNotMatch(landing, /landing-legacy/);

    const auctionTab = src('components/market/AuctionTab.tsx');
    assert.doesNotMatch(auctionTab, /\/legacy/);
  });

  it('product chrome does not say BidDrift', () => {
    for (const file of PRODUCT_UI) {
      assert.doesNotMatch(src(file), /BidDrift/);
    }
    assert.match(src('app/layout.tsx'), /Stellar4/);
  });

  it('theme keys are stellar4 with biddrift fallback', () => {
    const theme = src('components/ThemeProvider.tsx');
    assert.match(theme, /stellar4:palette/);
    assert.match(theme, /stellar4:mode/);
    assert.match(theme, /biddrift:palette/);
    assert.match(theme, /biddrift:mode/);

    const layout = src('app/layout.tsx');
    assert.match(layout, /stellar4:palette/);
    assert.match(layout, /biddrift:palette/);
  });
});
