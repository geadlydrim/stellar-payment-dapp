/**
 * Player-facing error copy. Kit-free so Game UI can sanitize without
 * importing adapters or Stellar.
 */

const GENERIC = 'Something went wrong. Try again.';

const METHOD_FALLBACK: Record<string, string> = {
  mint: "Couldn't export this item. Try again.",
  burn: "Couldn't bring this NFT back to Play. Try again.",
  transfer: "Couldn't move that NFT. Try again.",
  bid: "Couldn't place that bid.",
  close: "Couldn't settle this auction.",
  create_nft_auction: "Couldn't start the auction. Try again.",
  list: "Couldn't list this NFT. Try again.",
  buy: "Couldn't complete the purchase.",
  cancel: "Couldn't cancel that listing.",
  list_for_offers: "Couldn't open this trade listing. Try again.",
  submit_offer: "Couldn't submit that offer.",
  accept_offer: "Couldn't accept that offer.",
  reject_offer: "Couldn't reject that offer.",
  cancel_listing: "Couldn't cancel that listing.",
};

const CONTRACT_CODE_RE = /Error\(\s*Contract\s*,\s*#(\d+)\s*\)/i;
const HOST_HASH_RE = /HostError[\s\S]*?#(\d+)/i;

export function errorText(err: unknown): string {
  if (err instanceof Error && err.message) return err.message.trim();
  if (typeof err === 'string' && err.trim()) return err.trim();
  return '';
}

export function looksLikeChainDump(message: string): boolean {
  return (
    /HostError|Error\(\s*Contract|Event log|Diagnostic Event|fn_call|Submit error:|simulation failed|Bad union switch|xdr/i.test(
      message
    ) || message.length > 180
  );
}

export function parseContractErrorCode(message: string): number | undefined {
  const contract = message.match(CONTRACT_CODE_RE);
  if (contract) return Number(contract[1]);
  const host = message.match(HOST_HASH_RE);
  if (host) return Number(host[1]);
  return undefined;
}

function walletOrNetworkMessage(raw: string): string | undefined {
  if (
    /user rejected|rejected by the user|denied request|user declined|cancelled the request|canceled the request|closed the window/i.test(
      raw
    )
  ) {
    return 'Wallet request cancelled.';
  }
  if (/insufficient (funds|balance|xlm)|op_underfunded/i.test(raw)) {
    return 'Not enough XLM in this wallet (leave a little extra for fees).';
  }
  if (
    /timed out waiting|timeout|network error|failed to fetch|load failed|econnrefused|rpc timeout/i.test(
      raw
    )
  ) {
    return 'Network timed out. Try again.';
  }
  if (/transaction rejected by network/i.test(raw)) {
    return 'The network rejected this transaction. Try again.';
  }
  if (/freighter/i.test(raw) && /not (installed|found|detected)/i.test(raw)) {
    return 'Install or unlock Freighter, then try again.';
  }
  return undefined;
}

function mapContractCode(method: string, code: number): string | undefined {
  switch (method) {
    case 'mint':
      if (code === 4) return "This wallet can't mint that way. Export from Play with the connected wallet.";
      if (code === 5) return "This wallet doesn't own that NFT.";
      if (code === 6) return "That NFT wasn't found. Export it again from Play.";
      if (code === 8) return 'This item is already an NFT.';
      return METHOD_FALLBACK.mint;
    case 'burn':
      if (code === 5) return "This wallet doesn't own that NFT.";
      if (code === 6) return "That NFT wasn't found on-chain.";
      return METHOD_FALLBACK.burn;
    case 'close':
      if (code === 3) return 'Auction not found.';
      if (code === 7) {
        return 'This auction is still running. Wait for the timer, then settle.';
      }
      if (code === 8) return 'This auction is already settled.';
      return METHOD_FALLBACK.close;
    case 'bid':
      if (code === 3) return 'Auction not found.';
      if (code === 4) return 'This auction has already ended.';
      if (code === 5) return 'Bid is too low. Raise the amount and try again.';
      if (code === 6) return "You can't bid on your own auction.";
      if (code === 9) return 'Enter a valid bid amount.';
      return METHOD_FALLBACK.bid;
    case 'create_nft_auction':
      if (code === 9) return 'Enter a valid starting price.';
      if (code === 10) return "This wallet doesn't own that NFT.";
      return METHOD_FALLBACK.create_nft_auction;
    case 'buy':
      if (code === 3) return 'Listing not found.';
      if (code === 4) return 'This listing is no longer for sale.';
      if (code === 6) return "This NFT isn't available to buy right now.";
      if (code === 8) return "You can't buy your own listing.";
      return METHOD_FALLBACK.buy;
    case 'list':
      if (code === 6) return "This wallet doesn't own that NFT.";
      if (code === 7) return 'Enter a valid price.';
      return METHOD_FALLBACK.list;
    case 'cancel':
      if (code === 3) return 'Listing not found.';
      if (code === 4) return 'This listing is no longer active.';
      if (code === 5) return 'Only the seller can cancel.';
      return METHOD_FALLBACK.cancel;
    case 'list_for_offers':
      if (code === 8) return "This wallet doesn't own that NFT.";
      return METHOD_FALLBACK.list_for_offers;
    case 'submit_offer':
      if (code === 5) return 'This trade listing is no longer open.';
      if (code === 9) return 'Add some XLM, an NFT, or both.';
      if (code === 10) return "You can't offer on your own listing.";
      return METHOD_FALLBACK.submit_offer;
    case 'accept_offer':
    case 'reject_offer':
      if (code === 4) return 'Offer not found.';
      if (code === 5) return 'This trade listing is no longer open.';
      if (code === 6) return 'Only the seller can do that.';
      if (code === 11) return 'That offer is no longer pending.';
      return METHOD_FALLBACK[method];
    case 'cancel_listing':
      if (code === 5) return 'This listing is no longer open.';
      if (code === 6) return 'Only the seller can cancel.';
      return METHOD_FALLBACK.cancel_listing;
    default:
      return undefined;
  }
}

const KNOWN_REWRITES: Array<[RegExp, string]> = [
  [/^Item not found/i, 'Item not found.'],
  [/^No item found for tokenId/i, "Couldn't find that NFT in your inventory."],
  [/^Cannot export item in state/i, "This item isn't ready to export."],
  [/^Cannot import:/i, "This item isn't an NFT you can bring back to Play right now."],
  [/^Cannot equip:/i, "This item isn't in your bag. Bring it back to Play first."],
  [/^Cannot use:/i, "This item isn't in your bag. Bring it back to Play first."],
  [/^Cannot export:/i, 'This item is already an NFT.'],
  [/^tokenId is required/i, 'Pick an NFT first.'],
  [/^priceXlm must be > 0/i, 'Enter a price greater than 0.'],
  [/^durationSec must be > 0/i, 'Enter a duration greater than 0 seconds.'],
  [/^Invalid XLM amount/i, 'Enter a valid XLM amount.'],
  [/^Invalid on-chain TokenId|^TokenId out of u32|^Invalid on-chain token id/i,
    "This NFT isn't on the current network. Export it again from Play.",
  ],
  [/^Invalid listing\/auction id/i, 'Listing not found.'],
  [/^Registry owner does not match seller/i, "This NFT isn't in your inventory."],
  [/^Connected wallet is not the on-chain NFT owner/i, "This wallet doesn't own that NFT."],
  [/must be a Stellar public key/i, 'Connect a Stellar wallet to continue.'],
  [/^create_nft_auction returned|^list succeeded but returned|^list_for_offers returned|^submit_offer returned|^mint succeeded but returned/i,
    "Couldn't finish that on the network. Try again.",
  ],
];

function rewriteKnown(raw: string): string | undefined {
  for (const [re, msg] of KNOWN_REWRITES) {
    if (re.test(raw)) return msg;
  }
  return undefined;
}

export function toUserMessage(
  err: unknown,
  opts?: { method?: string; fallback?: string }
): string {
  const fallback = opts?.fallback ?? GENERIC;
  const raw = errorText(err);
  if (!raw) return fallback;

  const wallet = walletOrNetworkMessage(raw);
  if (wallet) return wallet;

  const known = rewriteKnown(raw);
  if (known) return known;

  const code = parseContractErrorCode(raw);
  if (opts?.method && code !== undefined) {
    const mapped = mapContractCode(opts.method, code);
    if (mapped) return mapped;
  }
  if (code !== undefined) {
    if (opts?.method && METHOD_FALLBACK[opts.method]) {
      return METHOD_FALLBACK[opts.method];
    }
    return "That action isn't allowed right now.";
  }

  if (!looksLikeChainDump(raw)) return raw;
  if (opts?.method && METHOD_FALLBACK[opts.method]) {
    return METHOD_FALLBACK[opts.method];
  }
  return fallback;
}
