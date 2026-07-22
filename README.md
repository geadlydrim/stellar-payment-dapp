# BidDrift

Real-time multi-auction marketplace on Stellar testnet — create listings, escrow XLM bids, settle winners, and watch the board update live from on-chain events.

[![Stellar](https://img.shields.io/badge/Stellar-Testnet-blue)](https://stellar.org)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org)
[![Soroban](https://img.shields.io/badge/Soroban-Contract-purple)](https://developers.stellar.org/docs/build/smart-contracts)

**Demo:** 
_https://bid-drift.vercel.app/_

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

**Connect wallet**

<img width="1100" alt="Screenshot From 2026-07-22 22-59-45" src="https://github.com/user-attachments/assets/af11ca45-4fa7-4c1d-ad66-fc86a1400b04" />
<img width="238" height="73" alt="image" src="https://github.com/user-attachments/assets/933364f1-13a5-473d-bf0e-962b67319303" />

**Auction list + live activity**

<img width="1100" alt="image" src="https://github.com/user-attachments/assets/e3201ed7-0ef4-48fc-bd50-db237b1a168a" />
<img width="1100" alt="image" src="https://github.com/user-attachments/assets/d7feb690-3134-48bf-8cd1-e2b892c092d1" />

**Create auction — transaction status**

<img width="330" alt="image" src="https://github.com/user-attachments/assets/7ce8c6d2-5937-4044-b1aa-bb7ae62e86ae" />
<img width="330" alt="image" src="https://github.com/user-attachments/assets/6504042f-9164-4f70-890e-b3e9c11a3e11" />
<img width="330" alt="image" src="https://github.com/user-attachments/assets/16826f45-8c64-4c42-8a07-22067463fde3" />

**Place bid — success**

<img width="500" alt="Screenshot From 2026-07-22 23-08-56" src="https://github.com/user-attachments/assets/1449fef9-f280-4b23-bb27-675f9709e598" />
<img width="500" alt="image" src="https://github.com/user-attachments/assets/d550aa98-e1a3-444b-aaa7-653ac8f1c063" />

**Auction End**

<img width="330" alt="image" src="https://github.com/user-attachments/assets/21cc98c9-8d63-4280-b761-0d2ea0be2e1e" />
<img width="330" alt="image" src="https://github.com/user-attachments/assets/03bdfc86-25a4-4f05-a421-0f339ce5f194" />
<img width="330" alt="image" src="https://github.com/user-attachments/assets/98fc1540-b4ef-4909-affe-36096440d518" />


**Mobile**

<img width="240" alt="Screenshot From 2026-07-22 23-12-21" src="https://github.com/user-attachments/assets/40a8ab86-aad2-4d47-9c21-ac14f693cb1c" />
<img width="240" alt="Screenshot From 2026-07-22 23-13-03" src="https://github.com/user-attachments/assets/3a0edff5-4fa2-46ad-b8b8-927a6175b3f8" />
<img width="240" alt="Screenshot From 2026-07-22 23-13-13" src="https://github.com/user-attachments/assets/d739a038-8787-41c9-ac0b-0ebe8df9c206" />
<img width="240" alt="Screenshot From 2026-07-22 23-13-21" src="https://github.com/user-attachments/assets/5ba505d6-4052-4e32-ad52-fd7ed2b6f663" />

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
