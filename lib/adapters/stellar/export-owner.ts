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
    throw new PortError(
      'Cannot export guest inventory on the stellar adapter — connect a wallet and play as that G…'
    );
  }
}

/**
 * Session ownerId and the mint signer must be the same Stellar account (G…).
 */
export function assertStellarExportOwner(ownerId: string, signer: string): void {
  assertNotGuestExportOwner(ownerId);
  if (!isStellarPublicKey(ownerId)) {
    throw new PortError(
      `ownerId must be a Stellar public key (G…) for the stellar adapter — got "${ownerId}"`
    );
  }
  if (!isStellarPublicKey(signer)) {
    throw new PortError(
      `wallet must be a Stellar public key (G…) for the stellar adapter — got "${signer}"`
    );
  }
  if (ownerId !== signer) {
    throw new PortError('Export ownerId must match the connected wallet');
  }
}
