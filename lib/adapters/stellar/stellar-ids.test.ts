import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  listingIdToU32,
  tokenIdToU32,
  u32ToTokenId,
} from '@/lib/adapters/stellar/ids';
import {
  canUseStellarAdapter,
  resolveMarketAdapterKind,
} from '@/lib/adapters/stellar/env';
import { PortError } from '@/lib/adapters/helpers';

describe('stellar TokenId ↔ u32 boundary', () => {
  it('round-trips decimal strings', () => {
    assert.equal(u32ToTokenId(0), '0');
    assert.equal(u32ToTokenId(42), '42');
    assert.equal(tokenIdToU32('42'), 42);
    assert.equal(listingIdToU32('7'), 7);
    assert.equal(listingIdToU32(7), 7);
  });

  it('rejects mock-style token ids', () => {
    assert.throws(() => tokenIdToU32('mock-nft-abc'), PortError);
  });
});

describe('stellar adapter env gate', () => {
  it('defaults to mock when adapter unset or IDs missing', () => {
    // CI / local without .env.local stellar IDs
    assert.equal(canUseStellarAdapter(), false);
    assert.equal(resolveMarketAdapterKind(), 'mock');
  });
});
