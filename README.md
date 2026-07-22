# BidDrift

Real-time multi-auction marketplace on Stellar testnet — create listings, escrow XLM bids, settle winners, and watch the board update live from on-chain events.

[![Stellar](https://img.shields.io/badge/Stellar-Testnet-blue)](https://stellar.org)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org)
[![Soroban](https://img.shields.io/badge/Soroban-Contract-purple)](https://developers.stellar.org/docs/build/smart-contracts)

**Demo:** _[add your live demo URL here]_

## What it is

BidDrift is a live auction dApp backed by a Soroban smart contract. Anyone can create an auction — item name, description, starting price, duration. Bidders lock native XLM into the contract; when someone outbids you, your funds are refunded automatically. When the timer runs out, the auction can be closed and the seller receives the winning bid.

Connect with Freighter, xBull, Albedo, or any wallet Stellar Wallets Kit supports. The UI reads and writes contract state over Soroban RPC, tracks every transaction through pending → confirmed → failed, and keeps a live activity feed in sync without manual refresh.

## On-chain deployment

| | |
|--|--|
| **Contract** | [`CCUVKVMD5WDNQM6TSJVF4QTSH2U43T6RPXULZCT3CRAOJ45UIW2Z5B5G`](https://stellar.expert/explorer/testnet/contract/CCUVKVMD5WDNQM6TSJVF4QTSH2U43T6RPXULZCT3CRAOJ45UIW2Z5B5G) |
| **Example tx** | [`08754e4bed4be99cfcab0601ca9f95f607dcace4b1f25a6030a61e0a25627a4f`](https://stellar.expert/explorer/testnet/tx/08754e4bed4be99cfcab0601ca9f95f607dcace4b1f25a6030a61e0a25627a4f) — `create_auction` |

## Features

- **Multi-wallet connect** — Stellar Wallets Kit modal; Freighter, xBull, Albedo, and other supported wallets
- **Create auctions** — item, description, start price (XLM), duration; seller auth on-chain
- **Escrowed bidding** — bids transfer XLM into the contract; previous highest bidder refunded on outbid
- **Settle on close** — after end time, close pays the seller; status moves to settled
- **Contract reads & writes** — `create_auction`, `bid`, `close`, `list_auctions`, `get_auction` from the frontend via Soroban RPC
- **Transaction status** — pending spinner while the network confirms; success shows hash + Stellar Expert link; failure shows a clear message
- **Real-time sync** — Soroban `getEvents` polling (~5s), live activity feed (created / bid / closed), on-chain backfill on page load, per-auction countdowns
- **Theming** — Sherbet and Mint Fog palettes, each with day and night mode

## Error handling

BidDrift surfaces failures in plain language instead of raw RPC or wallet errors:

| Situation | What you see |
|-----------|--------------|
| No wallet installed / not found | Prompt to install Freighter or another supported wallet |
| Connection rejected in wallet | "Connection request was declined" |
| Insufficient XLM for a bid | Balance check before submit + contract-side insufficient funds |
| Bid below current / start price | "Bid is too low — raise above the current bid" |
| Auction already ended | "This auction has already ended" |
| Seller bids on own auction | "You cannot bid on your own auction" |
| Close before timer ends | "Auction is still live — wait until the timer ends" |
| Contract not configured | Clear note to set the contract ID in `.env.local` |

Soroban `contracterror` codes from the auction contract are mapped to the same friendly copy in the UI.

## Screenshots

_[Add screenshots here]_

**Connect wallet**

<!-- screenshot -->

**Auction list + live activity**

<!-- screenshot -->

**Create auction — transaction status**

<!-- screenshot -->

**Place bid — success**

<!-- screenshot -->

**Mobile**

<!-- screenshot -->

## Tech stack

| Technology | Purpose |
|------------|---------|
| Next.js 14 (App Router) | React frontend |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| `@stellar/stellar-sdk` | Horizon + Soroban RPC |
| Stellar Wallets Kit | Multi-wallet signing |
| Soroban (Rust) | Escrow auction contract |

## Getting started

### Prerequisites

- Node.js 18+
- A Stellar wallet extension — [Freighter](https://freighter.app) is the easiest to start with

### Run it

```bash
cp .env.example .env.local
# set NEXT_PUBLIC_AUCTION_CONTRACT_ID to the deployed contract (or use the address above)

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Get testnet XLM

1. Connect your wallet in the app
2. Copy your address from the header
3. Fund it at [Stellar Laboratory Friendbot](https://laboratory.stellar.org/#account-creator?network=test)

### Contract source

Build and redeploy from [`contracts/auction/README.md`](contracts/auction/README.md).

## Project structure

```
stellar-payment-dapp/
├── app/                      # Next.js app router
├── components/
│   ├── AuctionApp.tsx        # layout, wallet, real-time orchestration
│   ├── auction/              # list, card, create, detail, feed, tx status
│   └── ui/                   # Toast, Confetti, …
├── lib/
│   ├── wallet.ts             # StellarWalletsKit
│   ├── soroban.ts            # invoke, readView, getEvents
│   ├── auction.ts            # typed contract wrappers
│   └── stellar-helper.ts     # balance + explorer helpers
└── contracts/auction/        # Rust Soroban contract
```

---

Built on Stellar testnet. No real funds involved.
