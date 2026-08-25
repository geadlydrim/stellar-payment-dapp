/**
 * Stellar export identity checks. Kit-free — tests can import this without
 * Freighter / soroban. StellarNftBridge calls these around mint.
 */

import { PortError } from '@/lib/adapters/helpers';
import { GUEST_OWNER_ID, isStellarPublicKey } from '@/lib/identity/owner';

/**
 * Guest bag must not mint on the stellar adapter (would send `to` = connected G…).
 */
export function assertNotGuestExportOwner(ownerId: string): void {
  if (ownerId === GUEST_OWNER_ID) {
    throw new PortError('Connect a wallet in Play first, then export from that account.');
  }
}

/**
 * Session ownerId and the mint signer must be the same Stellar account (G…).
 */
export function assertStellarExportOwner(ownerId: string, signer: string): void {
  assertNotGuestExportOwner(ownerId);
  if (!isStellarPublicKey(ownerId)) {
    throw new PortError('Connect a Stellar wallet to continue.');
  }
  if (!isStellarPublicKey(signer)) {
    throw new PortError('Connect a Stellar wallet to continue.');
  }
  if (ownerId !== signer) {
    throw new PortError('Export must use the connected wallet.');
  }
}
