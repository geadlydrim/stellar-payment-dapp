import type { TokenId } from '@/lib/registry';

export interface TradeListing {
  listingId: string | number;
  tokenId: TokenId;
  seller: string;
  /** Optional free-text or structured hint: what they want */
  wantsHint?: string;
  active: boolean;
}

export interface TradeOffer {
  offerId: string | number;
  listingId: string | number;
  buyer: string;
  /** XLM offered (may be "0") */
  xlm: string;
  /** Other NFT token ids offered in addition to / instead of XLM */
  offerTokenIds: TokenId[];
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
}

export interface OfferBoardPort {
  listForOffers(params: {
    tokenId: TokenId;
    seller: string;
    wantsHint?: string;
  }): Promise<TradeListing>;

  submitOffer(params: {
    listingId: string | number;
    buyer: string;
    xlm: string;
    offerTokenIds: TokenId[];
  }): Promise<TradeOffer>;

  acceptOffer(params: {
    offerId: string | number;
    seller: string;
  }): Promise<void>;

  rejectOffer(params: {
    offerId: string | number;
    seller: string;
  }): Promise<void>;

  cancelListing?(params: {
    listingId: string | number;
    seller: string;
  }): Promise<void>;

  listActive?(): Promise<TradeListing[]>;
  listOffers?(listingId: string | number): Promise<TradeOffer[]>;
}
