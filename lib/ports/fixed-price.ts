import type { TokenId } from '@/lib/registry';

export interface FixedPriceListing {
  listingId: string | number;
  tokenId: TokenId;
  seller: string;
  priceXlm: string;
  active: boolean;
}

export interface FixedPricePort {
  list(params: {
    tokenId: TokenId;
    seller: string;
    priceXlm: string;
  }): Promise<FixedPriceListing>;

  buy(params: {
    listingId: string | number;
    buyer: string;
  }): Promise<{ listingId: string | number; tokenId: TokenId }>;

  cancel(params: {
    listingId: string | number;
    seller: string;
  }): Promise<void>;

  listActive?(): Promise<FixedPriceListing[]>;
}
