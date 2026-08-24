/**
 * Pure session-owner helpers. No Stellar SDK and no wallet-kit import.
 * Game still receives ownerId: string; Registry remains inventory truth.
 */

import { PLAYER_OWNER_ID } from '@/lib/game';

/** Guest / mock inventory owner. Same string Game uses. */
export const GUEST_OWNER_ID = PLAYER_OWNER_ID;
export { PLAYER_OWNER_ID };

/** Stellar account id: G + 55 A–Z / 0–9 (same check as MarketApp). */
const STELLAR_PUBLIC_KEY_RE = /^G[A-Z0-9]{55}$/;

export function isStellarPublicKey(s: string): boolean {
  return STELLAR_PUBLIC_KEY_RE.test(s);
}

export type SessionOwner = {
  ownerId: string;
  kind: 'guest' | 'wallet';
};

export type ResolveOwnerInput = {
  adapter: 'mock' | 'stellar';
  publicKey: string | null | undefined;
};

/**
 * Mock → guest bag (Freighter unused).
 * Stellar + valid G… → that wallet.
 * Stellar + no/invalid key → null (composition root must gate UI).
 */
export function resolveOwnerId(input: ResolveOwnerInput): SessionOwner | null {
  if (input.adapter !== 'stellar') {
    return { ownerId: GUEST_OWNER_ID, kind: 'guest' };
  }
  const key = input.publicKey?.trim() ?? '';
  if (!isStellarPublicKey(key)) return null;
  return { ownerId: key, kind: 'wallet' };
}

/** Display helper for stellar banners (GABC…WXYZ). */
export function shortOwnerId(id: string, head = 4, tail = 4): string {
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}
