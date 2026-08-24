import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { MemoryItemRegistry } from '@/lib/registry';
import { PortError, transferItemOwner } from '@/lib/adapters/helpers';
import { MockNftBridge } from '@/lib/adapters/mock/nft-bridge';
import { GUEST_OWNER_ID } from '@/lib/identity/owner';
import {
  assertNotGuestExportOwner,
  assertStellarExportOwner,
} from '@/lib/adapters/stellar/export-owner';
import { StellarNftBridge } from '@/lib/adapters/stellar/nft-bridge';
import type { StellarContractIds } from '@/lib/adapters/stellar/env';

function fakeG(fill = 'A'): string {
  return `G${fill.repeat(55)}`;
}

const CONTRACTS: StellarContractIds = {
  itemNft: `C${'A'.repeat(55)}`,
  auction: `C${'B'.repeat(55)}`,
  fixedPrice: `C${'C'.repeat(55)}`,
  offerBoard: `C${'D'.repeat(55)}`,
};

function src(rel: string): string {
  return readFileSync(rel, 'utf8');
}

const weaponMeta = {
  name: 'Test Blade',
  description: 'sharp',
  kind: 'weapon',
};

describe('stellar export owner checks (identity 05)', () => {
  it('rejects the guest id', () => {
    assert.throws(
      () => assertNotGuestExportOwner(GUEST_OWNER_ID),
      (err: unknown) => {
        assert.ok(err instanceof PortError);
        assert.match(err.message, /guest/i);
        return true;
      }
    );
    assert.throws(() => assertStellarExportOwner(GUEST_OWNER_ID, fakeG()), PortError);
  });

  it('requires ownerId === signer, both G…', () => {
    const a = fakeG('A');
    const b = fakeG('B');
    assert.doesNotThrow(() => assertStellarExportOwner(a, a));
    assert.throws(() => assertStellarExportOwner(a, b), /match the connected wallet/);
    assert.throws(() => assertStellarExportOwner('player-1', a), /Stellar public key/);
  });
});

describe('StellarNftBridge.exportToNft remaps Registry owner', () => {
  it('sets ownerId to the signer after mint', async () => {
    const signer = fakeG('A');
    const registry = new MemoryItemRegistry();
    const item = registry.create(signer, weaponMeta);
    let mintedFor: { itemId: string; signer: string } | undefined;
    const bridge = new StellarNftBridge({
      registry,
      contracts: CONTRACTS,
      resolveSigner: async () => signer,
      mintToken: async (itemId, mintSigner) => {
        mintedFor = { itemId, signer: mintSigner };
        return '42';
      },
    });

    const { tokenId } = await bridge.exportToNft(item.id, signer);
    assert.equal(tokenId, '42');
    assert.deepEqual(mintedFor, { itemId: item.id, signer });
    const exported = registry.get(item.id)!;
    assert.equal(exported.state, 'AsNft');
    assert.equal(exported.tokenId, '42');
    assert.equal(exported.ownerId, signer);
    assert.equal(registry.listByOwner(signer).some((i) => i.id === item.id), true);
    assert.equal(registry.listByOwner(GUEST_OWNER_ID).some((i) => i.id === item.id), false);
  });

  it('rejects guest ownerId before mint', async () => {
    const signer = fakeG('B');
    const registry = new MemoryItemRegistry();
    const item = registry.create(GUEST_OWNER_ID, weaponMeta);
    let minted = false;
    const bridge = new StellarNftBridge({
      registry,
      contracts: CONTRACTS,
      resolveSigner: async () => signer,
      mintToken: async () => {
        minted = true;
        return '1';
      },
    });

    await assert.rejects(
      () => bridge.exportToNft(item.id, GUEST_OWNER_ID),
      /guest/i
    );
    assert.equal(minted, false);
    const row = registry.get(item.id)!;
    assert.equal(row.ownerId, GUEST_OWNER_ID);
    assert.equal(row.state, 'InGame');
    assert.equal(row.tokenId, undefined);
  });

  it('rejects ownerId that is not the signer', async () => {
    const a = fakeG('A');
    const b = fakeG('B');
    const registry = new MemoryItemRegistry();
    const item = registry.create(a, weaponMeta);
    let minted = false;
    const bridge = new StellarNftBridge({
      registry,
      contracts: CONTRACTS,
      resolveSigner: async () => b,
      mintToken: async () => {
        minted = true;
        return '1';
      },
    });

    await assert.rejects(
      () => bridge.exportToNft(item.id, a),
      /match the connected wallet/
    );
    assert.equal(minted, false);
    assert.equal(registry.get(item.id)!.state, 'InGame');
  });

  it('does not remap a historical guest AsNft row (P7b out of scope)', async () => {
    const signer = fakeG('C');
    const registry = new MemoryItemRegistry();
    const item = registry.create(GUEST_OWNER_ID, weaponMeta);
    registry.lockForTrade(item.id, GUEST_OWNER_ID);
    registry.markAsNft(item.id, '99');

    const bridge = new StellarNftBridge({
      registry,
      contracts: CONTRACTS,
      resolveSigner: async () => signer,
      mintToken: async () => '100',
    });

    await assert.rejects(
      () => bridge.exportToNft(item.id, GUEST_OWNER_ID),
      /guest/i
    );
    await assert.rejects(
      () => bridge.exportToNft(item.id, signer),
      /Not your item/
    );
    const row = registry.get(item.id)!;
    assert.equal(row.ownerId, GUEST_OWNER_ID);
    assert.equal(row.tokenId, '99');
  });
});

describe('MockNftBridge export leaves owner unchanged', () => {
  it('guest export stays guest-owned (no stellar remap)', async () => {
    const registry = new MemoryItemRegistry();
    const item = registry.create(GUEST_OWNER_ID, weaponMeta);
    const bridge = new MockNftBridge({
      registry,
      idFactory: () => 'mock-nft-1',
    });
    const { tokenId } = await bridge.exportToNft(item.id, GUEST_OWNER_ID);
    const exported = registry.get(item.id)!;
    assert.equal(tokenId, 'mock-nft-1');
    assert.equal(exported.state, 'AsNft');
    assert.equal(exported.ownerId, GUEST_OWNER_ID);
  });
});

describe('identity 05 source guards', () => {
  it('stellar export remaps via transferItemOwner after markAsNft', () => {
    const text = src('lib/adapters/stellar/nft-bridge.ts');
    assert.match(text, /assertNotGuestExportOwner\(ownerId\)/);
    assert.match(text, /assertStellarExportOwner\(ownerId, signer\)/);
    assert.match(
      text,
      /markAsNft\(itemId, tokenId\);\s*[\s\S]{0,200}transferItemOwner\(this\.registry, itemId, signer\)/
    );
    assert.doesNotMatch(text, /Keep Registry ownerId as the game player/);
    assert.doesNotMatch(text, /PLAYER_OWNER_ID/);
    assert.match(text, /item\.ownerId !== ownerId/);
    assert.match(text, /onChainOwner !== signer/);
  });

  it('mock bridge does not remap owner on export', () => {
    const text = src('lib/adapters/mock/nft-bridge.ts');
    assert.doesNotMatch(text, /transferItemOwner/);
    assert.doesNotMatch(text, /GUEST_OWNER_ID|stellar4-player/);
  });

  it('UI still passes session ownerId; data-hooks remain', () => {
    const text = src('components/game/ItemDetailModal.tsx');
    assert.match(text, /exportToNft\(\s*item\.id\s*,\s*ownerId/);
    assert.match(text, /importFromNft\(\s*item\.tokenId\s*,\s*ownerId/);
    assert.match(text, /data-hook="export-to-nft-confirm"/);
    assert.match(text, /data-hook="import-from-nft"/);
    assert.doesNotMatch(text, /PLAYER_OWNER_ID/);
  });

  it('stellar listable asserts Registry owner === seller after chain check', () => {
    const text = src('lib/adapters/stellar/listable.ts');
    assert.match(text, /onChainOwner/);
    assert.match(text, /item\.ownerId !== seller/);
  });

  it('does not batch-remap guest rows onto getPublicKey', () => {
    const files = [
      'lib/adapters/stellar/nft-bridge.ts',
      'lib/adapters/stellar/export-owner.ts',
      'lib/adapters/stellar/listable.ts',
      'lib/identity/owner.ts',
      'components/identity/PlayShell.tsx',
      'components/identity/WalletSessionProvider.tsx',
      'components/market/MarketApp.tsx',
    ];
    for (const file of files) {
      const text = src(file);
      assert.doesNotMatch(text, /listAll\(\)[\s\S]{0,400}getPublicKey/);
      assert.doesNotMatch(text, /listByOwner\(\s*GUEST_OWNER_ID[\s\S]{0,400}getPublicKey/);
      assert.doesNotMatch(
        text,
        /stellar4-player[\s\S]{0,200}ownerId\s*=\s*getPublicKey/
      );
    }
  });

  it('v2 workaround stays transferItemOwner (no Registry transferOwnership)', () => {
    assert.match(src('lib/adapters/helpers.ts'), /export function transferItemOwner/);
    assert.doesNotMatch(
      src('lib/registry/types.ts'),
      /transferOwnership/
    );
  });
});

describe('transferItemOwner still aligns a single row (not a bag loop)', () => {
  it('moves one item to the signer and leaves other guest rows', () => {
    const registry = new MemoryItemRegistry();
    const signer = fakeG('E');
    const exported = registry.create(GUEST_OWNER_ID, weaponMeta);
    const leftover = registry.create(GUEST_OWNER_ID, {
      ...weaponMeta,
      name: 'Stay guest',
    });
    registry.lockForTrade(exported.id, GUEST_OWNER_ID);
    registry.markAsNft(exported.id, '7');
    transferItemOwner(registry, exported.id, signer);
    assert.equal(registry.get(exported.id)!.ownerId, signer);
    assert.equal(registry.get(leftover.id)!.ownerId, GUEST_OWNER_ID);
  });
});
