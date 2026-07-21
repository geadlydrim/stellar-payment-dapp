/**
 * Typed wrappers around the auction Soroban contract.
 */

import { Address, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { invoke, readView, type InvokeResult } from './soroban';

export const STROOPS_PER_XLM = 10_000_000;

export interface Auction {
  id: number;
  seller: string;
  item: string;
  description: string;
  startPrice: number; // stroops
  endTime: number; // unix seconds
  highestBid: number; // stroops
  highestBidder: string | null;
  settled: boolean;
}

export type AuctionStatus = 'live' | 'ended' | 'settled';

export function auctionStatus(a: Auction, nowSec = Math.floor(Date.now() / 1000)): AuctionStatus {
  if (a.settled) return 'settled';
  if (nowSec >= a.endTime) return 'ended';
  return 'live';
}

export function xlmToStroops(xlm: number | string): bigint {
  const n = typeof xlm === 'string' ? parseFloat(xlm) : xlm;
  if (isNaN(n) || n < 0) throw new Error('Invalid XLM amount');
  return BigInt(Math.round(n * STROOPS_PER_XLM));
}

export function stroopsToXlm(stroops: number | bigint): string {
  const n = typeof stroops === 'bigint' ? Number(stroops) : stroops;
  return (n / STROOPS_PER_XLM).toFixed(7).replace(/\.?0+$/, '') || '0';
}

export function formatXlm(stroops: number | bigint, digits = 2): string {
  const n = typeof stroops === 'bigint' ? Number(stroops) : stroops;
  return (n / STROOPS_PER_XLM).toFixed(digits);
}

/** Map contracterror codes / common wallet errors to friendly copy. */
export function friendlyAuctionError(err: unknown): string {
  const raw =
    typeof err === 'string'
      ? err
      : err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : String(err ?? 'Unknown error');

  const lower = raw.toLowerCase();

  // Contract error codes embedded in simulation / host errors
  if (/\bError\(Contract,\s*#?1\)\b/i.test(raw) || lower.includes('notinitialized'))
    return 'Contract is not initialized yet.';
  if (/\bError\(Contract,\s*#?3\)\b/i.test(raw) || lower.includes('auctionnotfound'))
    return 'Auction not found.';
  if (/\bError\(Contract,\s*#?4\)\b/i.test(raw) || lower.includes('auctionended'))
    return 'This auction has already ended.';
  if (/\bError\(Contract,\s*#?5\)\b/i.test(raw) || lower.includes('bidtoolow'))
    return 'Bid is too low — raise above the current bid (or start price).';
  if (/\bError\(Contract,\s*#?6\)\b/i.test(raw) || lower.includes('selfbid'))
    return 'You cannot bid on your own auction.';
  if (/\bError\(Contract,\s*#?7\)\b/i.test(raw) || lower.includes('notended'))
    return 'Auction is still live — wait until the timer ends.';
  if (/\bError\(Contract,\s*#?8\)\b/i.test(raw) || lower.includes('alreadysettled'))
    return 'This auction was already settled.';
  if (/\bError\(Contract,\s*#?9\)\b/i.test(raw) || lower.includes('invalidamount'))
    return 'Invalid amount or duration.';

  if (lower.includes('insufficient') || lower.includes('balance'))
    return 'Insufficient XLM balance for this bid (plus fees).';
  if (lower.includes('rejected') || lower.includes('declined') || lower.includes('user declined'))
    return 'Transaction was rejected in your wallet.';
  if (lower.includes('not connected') || lower.includes('no address') || lower.includes('wallet'))
    return 'Connect a wallet first.';
  if (lower.includes('missing next_public_auction_contract_id'))
    return 'Auction contract ID is not configured. Deploy the contract and set NEXT_PUBLIC_AUCTION_CONTRACT_ID in .env.local.';

  return raw.length > 180 ? raw.slice(0, 180) + '…' : raw;
}

function addressScVal(addr: string): xdr.ScVal {
  return Address.fromString(addr).toScVal();
}

function i128ScVal(n: bigint): xdr.ScVal {
  return nativeToScVal(n, { type: 'i128' });
}

function u64ScVal(n: number | bigint): xdr.ScVal {
  return nativeToScVal(BigInt(n), { type: 'u64' });
}

function u32ScVal(n: number): xdr.ScVal {
  return nativeToScVal(n, { type: 'u32' });
}

function stringScVal(s: string): xdr.ScVal {
  return nativeToScVal(s, { type: 'string' });
}

function parseAuction(raw: Record<string, unknown>): Auction {
  const bidder = raw.highest_bidder;
  let highestBidder: string | null = null;
  if (bidder != null && bidder !== undefined) {
    if (typeof bidder === 'string') highestBidder = bidder;
    else if (typeof bidder === 'object' && bidder !== null) {
      // Option::Some may arrive as the address string already via scValToNative
      highestBidder = String(bidder);
    }
  }

  return {
    id: Number(raw.id ?? 0),
    seller: String(raw.seller ?? ''),
    item: String(raw.item ?? ''),
    description: String(raw.description ?? ''),
    startPrice: Number(raw.start_price ?? 0),
    endTime: Number(raw.end_time ?? 0),
    highestBid: Number(raw.highest_bid ?? 0),
    highestBidder,
    settled: Boolean(raw.settled),
  };
}

export async function listAuctions(): Promise<Auction[]> {
  const raw = await readView('list_auctions', []);
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => parseAuction(item as Record<string, unknown>));
}

export async function getAuction(id: number): Promise<Auction> {
  const raw = await readView('get_auction', [u32ScVal(id)]);
  return parseAuction(raw as Record<string, unknown>);
}

export async function createAuction(params: {
  seller: string;
  item: string;
  description: string;
  startPriceXlm: number | string;
  durationSec: number;
}): Promise<InvokeResult> {
  const startPrice = xlmToStroops(params.startPriceXlm);
  return invoke(
    'create_auction',
    [
      addressScVal(params.seller),
      stringScVal(params.item),
      stringScVal(params.description),
      i128ScVal(startPrice),
      u64ScVal(params.durationSec),
    ],
    params.seller
  );
}

export async function placeBid(params: {
  id: number;
  bidder: string;
  amountXlm: number | string;
}): Promise<InvokeResult> {
  const amount = xlmToStroops(params.amountXlm);
  return invoke(
    'bid',
    [u32ScVal(params.id), addressScVal(params.bidder), i128ScVal(amount)],
    params.bidder
  );
}

export async function closeAuction(params: {
  id: number;
  caller: string;
}): Promise<InvokeResult> {
  return invoke('close', [u32ScVal(params.id)], params.caller);
}
