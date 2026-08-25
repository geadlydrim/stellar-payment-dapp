import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
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

describe('play shell wiring (identity 03)', () => {
  it('app/play renders PlayShell, not a bare PlayApp', () => {
    const text = src('app/play/page.tsx');
    assert.match(text, /PlayShell/);
    assert.doesNotMatch(text, /from '@\/components\/game\/PlayApp'/);
  });

  it('PlayShell passes session.ownerId into PlayApp', () => {
    const text = src('components/identity/PlayShell.tsx');
    assert.match(text, /<PlayConnected[\s\S]*ownerId=\{session\.ownerId\}/);
    assert.match(text, /<PlayApp\s+ownerId=\{ownerId\}/);
    assert.match(text, /data-hook="play-connect-wallet"/);
    assert.doesNotMatch(text, /clearPersisted/);
    assert.doesNotMatch(text, /stellar-helper/);
    assert.doesNotMatch(text, /PLAYER_OWNER_ID/);
  });

  it('PlayShell injects nftBridge from getMarketPorts (P10)', () => {
    const text = src('components/identity/PlayShell.tsx');
    assert.match(text, /from '@\/lib\/adapters'/);
    assert.match(text, /getMarketPorts\(getGameRegistry\(\)\)/);
    assert.match(text, /nftBridge=\{ports\.nftBridge\}/);
    assert.match(text, /adapter=\{ports\.adapter\}/);
  });

  it('WalletSessionProvider uses lib/wallet only (no stellar-helper)', () => {
    const text = src('components/identity/WalletSessionProvider.tsx');
    assert.match(text, /from '@\/lib\/wallet'/);
    assert.match(text, /disconnect as walletDisconnect/);
    assert.doesNotMatch(text, /stellar-helper/);
    assert.doesNotMatch(text, /clearPersisted/);
    assert.doesNotMatch(text, /from '@\/lib\/stellar-helper'/);
  });

  it('layout mounts one WalletSessionProvider', () => {
    const text = src('app/layout.tsx');
    assert.match(text, /WalletSessionProvider/);
  });

  it('MarketApp consumes the session provider (inventory unify is identity 04)', () => {
    const text = src('components/market/MarketApp.tsx');
    assert.match(text, /useWalletSession/);
    assert.doesNotMatch(text, /from '@\/lib\/wallet'/);
    assert.doesNotMatch(text, /stellar-helper/);
  });
});

describe('identity path stays out of Game and stellar-helper', () => {
  it('lib/game and components/game do not import wallet or Stellar SDK', () => {
    const files = [...walkTs('lib/game'), ...walkTs('components/game')];
    assert.ok(files.length > 0);
    for (const file of files) {
      const text = src(file);
      assert.doesNotMatch(text, /lib\/wallet/);
      assert.doesNotMatch(text, /@stellar\//);
      assert.doesNotMatch(text, /stellar-helper/);
      assert.doesNotMatch(text, /lib\/soroban/);
      assert.doesNotMatch(text, /lib\/auction/);
      assert.doesNotMatch(text, /from ['"]@\/lib\/adapters['"]/);
    }
  });

  it('play + identity + MarketApp never import stellar-helper', () => {
    const files = [
      'app/play/page.tsx',
      'app/layout.tsx',
      ...walkTs('lib/identity'),
      ...walkTs('components/identity'),
      'components/market/MarketApp.tsx',
    ];
    for (const file of files) {
      assert.doesNotMatch(src(file), /stellar-helper/);
    }
  });
});
