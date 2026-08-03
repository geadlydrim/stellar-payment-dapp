import type { TokenId } from '@/lib/registry';
import { PortError } from '@/lib/adapters/helpers';

/**
 * Port TokenId (opaque string) ↔ on-chain NFT id (u32).
 * Boundary-only conversion — Registry keeps TokenId as string.
 */
export function tokenIdToU32(tokenId: TokenId): number {
  if (!/^\d+$/.test(tokenId)) {
    throw new PortError(
      `Invalid on-chain TokenId "${tokenId}" — expected decimal u32 string`
    );
  }
  const n = Number(tokenId);
  if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) {
    throw new PortError(`TokenId out of u32 range: ${tokenId}`);
  }
  return n;
}

export function u32ToTokenId(id: number | bigint | string): TokenId {
  const n = typeof id === 'bigint' ? Number(id) : Number(id);
  if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) {
    throw new PortError(`Invalid on-chain token id: ${id}`);
  }
  return String(n);
}

export function listingIdToU32(listingId: string | number): number {
  const n = typeof listingId === 'number' ? listingId : Number(listingId);
  if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) {
    throw new PortError(`Invalid listing/auction id: ${listingId}`);
  }
  return n;
}
