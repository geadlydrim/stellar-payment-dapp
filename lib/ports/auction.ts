import type { TokenId } from '@/lib/registry';

/** NFT-backed auction listing (legacy description-only auctions are transitional). */
export interface AuctionListing {
  auctionId: string | number;
  tokenId: TokenId;
  seller: string;
  startPriceXlm: string;
  endTime: number;
  highestBidXlm?: string;
  highestBidder?: string | null;
}

export interface AuctionPort {
  listNftAuction(params: {
    tokenId: TokenId;
    seller: string;
    startPriceXlm: string;
    durationSec: number;
  }): Promise<AuctionListing>;

  placeBid?(params: {
    auctionId: string | number;
    bidder: string;
    amountXlm: string;
  }): Promise<void>;

  close?(params: {
    auctionId: string | number;
    caller: string;
  }): Promise<void>;

  listActive?(): Promise<AuctionListing[]>;

  onSettled?(
    handler: (e: {
      auctionId: string | number;
      tokenId: TokenId;
      winner: string;
    }) => void
  ): () => void;
}
