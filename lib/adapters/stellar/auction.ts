import type { ItemRegistry, TokenId } from '@/lib/registry';
import type { AuctionListing, AuctionPort } from '@/lib/ports';
import {
  PortError,
  findItemByTokenId,
  parseXlm,
  transferItemOwner,
} from '@/lib/adapters/helpers';
import type { StellarContractIds } from './env';
import { listingIdToU32, tokenIdToU32, u32ToTokenId } from './ids';
import { requireListableChainOwner } from './listable';
import {
  addressScVal,
  assertStellarAddress,
  i128ScVal,
  invokeOrThrow,
  stroopsToXlm,
  u32ScVal,
  u64ScVal,
  viewOrThrow,
  xlmToStroops,
} from './sc';

export interface StellarAuctionPortOptions {
  registry: ItemRegistry;
  contracts: StellarContractIds;
  isTokenBusyElsewhere: (tokenId: TokenId) => boolean | Promise<boolean>;
}

type SettledHandler = (e: {
  auctionId: string | number;
  tokenId: TokenId;
  winner: string;
}) => void;

/**
 * AuctionPort → redeployed NFT-capable auction contract.
 * Uses create_nft_auction / bid / close. Legacy description-only auctions ignored in listActive.
 */
export class StellarAuctionPort implements AuctionPort {
  private readonly registry: ItemRegistry;
  private readonly contracts: StellarContractIds;
  private readonly isTokenBusyElsewhere: (
    tokenId: TokenId
  ) => boolean | Promise<boolean>;
  private readonly settledHandlers = new Set<SettledHandler>();

  constructor(options: StellarAuctionPortOptions) {
    this.registry = options.registry;
    this.contracts = options.contracts;
    this.isTokenBusyElsewhere = options.isTokenBusyElsewhere;
  }

  async listNftAuction(params: {
    tokenId: TokenId;
    seller: string;
    startPriceXlm: string;
    durationSec: number;
  }): Promise<AuctionListing> {
    await requireListableChainOwner(
      this.registry,
      this.contracts.itemNft,
      params.tokenId,
      params.seller
    );
    parseXlm(params.startPriceXlm);
    if (params.durationSec <= 0) {
      throw new PortError('durationSec must be > 0');
    }
    if (
      (await this.isActiveHere(params.tokenId)) ||
      (await this.isTokenBusyElsewhere(params.tokenId))
    ) {
      throw new PortError('Token is already listed on the marketplace');
    }

    const result = await invokeOrThrow(
      this.contracts.auction,
      'create_nft_auction',
      [
        addressScVal(params.seller),
        addressScVal(this.contracts.itemNft),
        u32ScVal(tokenIdToU32(params.tokenId)),
        i128ScVal(xlmToStroops(params.startPriceXlm)),
        u64ScVal(params.durationSec),
      ],
      params.seller
    );

    const auctionId =
      result.returnValue !== undefined && result.returnValue !== null
        ? Number(result.returnValue as number | bigint)
        : undefined;
    if (auctionId === undefined || !Number.isInteger(auctionId)) {
      throw new PortError('create_nft_auction returned no auction id');
    }

    const endTime = Date.now() + params.durationSec * 1000;
    return {
      auctionId,
      tokenId: params.tokenId,
      seller: params.seller,
      startPriceXlm: params.startPriceXlm,
      endTime,
      highestBidXlm: undefined,
      highestBidder: null,
    };
  }

  async placeBid(params: {
    auctionId: string | number;
    bidder: string;
    amountXlm: string;
  }): Promise<void> {
    assertStellarAddress(params.bidder, 'bidder');
    parseXlm(params.amountXlm);
    const id = listingIdToU32(params.auctionId);
    await invokeOrThrow(
      this.contracts.auction,
      'bid',
      [
        u32ScVal(id),
        addressScVal(params.bidder),
        i128ScVal(xlmToStroops(params.amountXlm)),
      ],
      params.bidder
    );
  }

  async close(params: {
    auctionId: string | number;
    caller: string;
  }): Promise<void> {
    assertStellarAddress(params.caller, 'caller');
    const id = listingIdToU32(params.auctionId);
    const before = await this.getAuctionRaw(id);
    const tokenIdOpt = before.token_id;
    if (tokenIdOpt == null) {
      throw new PortError(
        'Auction has no NFT token_id — use the redeployed NFT-capable auction contract'
      );
    }
    const tokenId = u32ToTokenId(tokenIdOpt as number | bigint);
    const item = findItemByTokenId(this.registry, tokenId);
    if (!item) throw new PortError('Auction item missing from registry');

    await invokeOrThrow(
      this.contracts.auction,
      'close',
      [u32ScVal(id)],
      params.caller
    );

    const winner = parseOptionalAddress(before.highest_bidder);
    if (winner) {
      transferItemOwner(this.registry, item.id, winner);
      for (const h of this.settledHandlers) {
        h({ auctionId: id, tokenId, winner });
      }
    }
  }

  async listActive(): Promise<AuctionListing[]> {
    const nowSec = Math.floor(Date.now() / 1000);
    const all = await this.listNftAuctions();
    return all.filter(
      (a) => !a.settled && Math.floor(a.endTime / 1000) > nowSec
    );
  }

  /** NFT auctions that are not yet settled (includes ended-but-open). */
  async listAll(): Promise<AuctionListing[]> {
    const all = await this.listNftAuctions();
    return all.filter((a) => !a.settled);
  }

  onSettled(handler: SettledHandler): () => void {
    this.settledHandlers.add(handler);
    return () => this.settledHandlers.delete(handler);
  }

  async isTokenListed(tokenId: TokenId): Promise<boolean> {
    const all = await this.listNftAuctions();
    return all.some((a) => a.tokenId === tokenId && !a.settled);
  }

  private async isActiveHere(tokenId: TokenId): Promise<boolean> {
    const nowSec = Math.floor(Date.now() / 1000);
    const all = await this.listNftAuctions();
    return all.some(
      (a) =>
        a.tokenId === tokenId &&
        !a.settled &&
        Math.floor(a.endTime / 1000) > nowSec
    );
  }

  private async listNftAuctions(): Promise<
    (AuctionListing & { settled: boolean })[]
  > {
    const raw = await viewOrThrow(this.contracts.auction, 'list_auctions', []);
    if (!Array.isArray(raw)) return [];
    const out: (AuctionListing & { settled: boolean })[] = [];
    for (const row of raw) {
      const mapped = this.mapAuction(row as Record<string, unknown>);
      if (mapped) out.push(mapped);
    }
    return out;
  }

  private async getAuctionRaw(id: number): Promise<Record<string, unknown>> {
    const raw = await viewOrThrow(this.contracts.auction, 'get_auction', [
      u32ScVal(id),
    ]);
    if (!raw || typeof raw !== 'object') {
      throw new PortError(`Auction not found: ${id}`);
    }
    return raw as Record<string, unknown>;
  }

  private mapAuction(
    raw: Record<string, unknown>
  ): (AuctionListing & { settled: boolean }) | null {
    const tokenRaw = raw.token_id;
    if (tokenRaw == null) return null; // skip description-only rows (no NFT)
    const highestBid = Number(raw.highest_bid ?? 0);
    return {
      auctionId: Number(raw.id ?? 0),
      tokenId: u32ToTokenId(tokenRaw as number | bigint),
      seller: String(raw.seller ?? ''),
      startPriceXlm: stroopsToXlm(raw.start_price as number | bigint),
      endTime: Number(raw.end_time ?? 0) * 1000,
      highestBidXlm: highestBid > 0 ? stroopsToXlm(highestBid) : undefined,
      highestBidder: parseOptionalAddress(raw.highest_bidder),
      settled: Boolean(raw.settled),
    };
  }
}

function parseOptionalAddress(bidder: unknown): string | null {
  if (bidder == null) return null;
  if (typeof bidder === 'string') return bidder || null;
  if (typeof bidder === 'object') return String(bidder);
  return null;
}
