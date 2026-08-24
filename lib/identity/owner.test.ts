import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { PLAYER_OWNER_ID } from '@/lib/game';
import {
  GUEST_OWNER_ID,
  isStellarPublicKey,
  resolveOwnerId,
  shortOwnerId,
} from '@/lib/identity/owner';

function fakeG(fill = 'A'): string {
  return `G${fill.repeat(55)}`;
}

describe('identity owner helpers', () => {
  it('re-exports the Game guest id', () => {
    assert.equal(GUEST_OWNER_ID, 'stellar4-player');
    assert.equal(GUEST_OWNER_ID, PLAYER_OWNER_ID);
  });

  it('accepts G + 55 A–Z/0–9 public keys', () => {
    assert.equal(isStellarPublicKey(fakeG()), true);
    assert.equal(isStellarPublicKey(fakeG('B')), true);
    assert.equal(isStellarPublicKey('G' + 'A'.repeat(54)), false);
    assert.equal(isStellarPublicKey('G' + 'A'.repeat(56)), false);
    assert.equal(isStellarPublicKey('g' + 'A'.repeat(55)), false);
    assert.equal(isStellarPublicKey('stellar4-player'), false);
    assert.equal(isStellarPublicKey(''), false);
  });

  it('mock always resolves to the guest bag', () => {
    assert.deepEqual(resolveOwnerId({ adapter: 'mock', publicKey: null }), {
      ownerId: GUEST_OWNER_ID,
      kind: 'guest',
    });
    assert.deepEqual(resolveOwnerId({ adapter: 'mock', publicKey: fakeG() }), {
      ownerId: GUEST_OWNER_ID,
      kind: 'guest',
    });
  });

  it('stellar without a wallet is null (gate, no guest bag)', () => {
    assert.equal(resolveOwnerId({ adapter: 'stellar', publicKey: null }), null);
    assert.equal(resolveOwnerId({ adapter: 'stellar', publicKey: '' }), null);
    assert.equal(
      resolveOwnerId({ adapter: 'stellar', publicKey: 'stellar4-player' }),
      null
    );
  });

  it('stellar + G… is that wallet only', () => {
    const a = fakeG('A');
    const b = fakeG('B');
    assert.deepEqual(resolveOwnerId({ adapter: 'stellar', publicKey: a }), {
      ownerId: a,
      kind: 'wallet',
    });
    assert.notEqual(
      resolveOwnerId({ adapter: 'stellar', publicKey: b })?.ownerId,
      a
    );
  });

  it('shortOwnerId matches the play banner shape', () => {
    const key = fakeG();
    assert.equal(shortOwnerId(key), `${key.slice(0, 4)}…${key.slice(-4)}`);
  });
});

describe('identity owner module stays kit-free', () => {
  it('does not import wallet, stellar-helper, or Stellar SDK', () => {
    const text = readFileSync('lib/identity/owner.ts', 'utf8');
    assert.doesNotMatch(text, /from ['"]@\/lib\/wallet['"]/);
    assert.doesNotMatch(text, /stellar-helper/);
    assert.doesNotMatch(text, /@stellar\//);
    assert.doesNotMatch(text, /stellar-wallets-kit/);
  });
});
