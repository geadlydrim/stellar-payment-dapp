/**
 * Map Soroban HostError / simulation strings to PortError at the adapter boundary.
 * Kit-free so tests can cover `#N` without Freighter.
 */

import { PortError } from '@/lib/adapters/helpers';
import {
  looksLikeChainDump,
  parseContractErrorCode,
  toUserMessage,
} from '@/lib/user-error';

export { parseContractErrorCode } from '@/lib/user-error';

/** item-nft `NftError::NotMinter` — mint-to-other without admin / set_minter. */
export const NFT_ERR_NOT_MINTER = 4;
/** item-nft `NftError::ItemAlreadyMinted` — live item_id already has a token. */
export const NFT_ERR_ITEM_ALREADY_MINTED = 8;
/** auction `AuctionError::NotEnded` — close before ledger timestamp. */
export const AUCTION_ERR_NOT_ENDED = 7;
/** auction `AuctionError::AlreadySettled`. */
export const AUCTION_ERR_ALREADY_SETTLED = 8;

function asPortError(err: unknown, method: string, fallback: string): PortError {
  if (err instanceof PortError && !looksLikeChainDump(err.message)) {
    return new PortError(toUserMessage(err, { method, fallback: err.message }));
  }
  return new PortError(toUserMessage(err, { method, fallback }));
}

/** Map a failed item-nft `mint` to a readable PortError. */
export function mintFailureToPortError(err: unknown): PortError {
  return asPortError(err, 'mint', "Couldn't export this item. Try again.");
}

/** Map a failed auction `close` to a readable PortError. */
export function auctionCloseFailureToPortError(err: unknown): PortError {
  return asPortError(
    err,
    'close',
    "Couldn't settle this auction. Try again."
  );
}

/** Map a failed invoke (any method) so HostError dumps never reach the UI. */
export function invokeFailureToPortError(method: string, err: unknown): PortError {
  return asPortError(err, method, "Something went wrong. Try again.");
}
