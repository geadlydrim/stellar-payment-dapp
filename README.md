# BidDrift

Real-time multi-auction dApp on Stellar testnet. Create listings, place escrowed XLM bids, settle winners, and watch the board update from on-chain events.

[![Stellar](https://img.shields.io/badge/Stellar-Testnet-blue)](https://stellar.org)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org)
[![Soroban](https://img.shields.io/badge/Soroban-Contract-purple)](https://developers.stellar.org/docs/build/smart-contracts)

## What it is

BidDrift is a live auction marketplace backed by a Soroban smart contract. Anyone can create an auction (item, description, start price, duration). Bidders escrow native XLM into the contract; when outbid they are refunded automatically; when the auction ends, anyone can close it and the seller is paid.

The UI connects via Stellar Wallets Kit (Freighter, xBull, Albedo, and more), shows pending → success / fail transaction status with Stellar Expert links, and polls Soroban RPC events so new bids and closings appear without a manual refresh.

## Features

- **Multi-wallet** — Stellar Wallets Kit modal connect / disconnect
- **Soroban auction contract** — create, bid (escrow + refund), close / settle
- **Transaction status** — pending spinner, success with hash + explorer link, fail with friendly errors
- **Error handling** — wallet rejected, insufficient balance, bid too low, auction ended, self-bid, and mapped `contracterror` codes
- **Real-time sync** — `getEvents` polling (~5s), live activity feed, per-card countdowns
- **Theming** — Sherbet / Mint Fog palettes with day / night modes (carried over from DriftPay)

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
- A Stellar wallet extension ([Freighter](https://freighter.app) recommended)
- A **deployed** auction contract on testnet (see below)

### 1. Deploy the contract

Follow the full guide in [`contracts/auction/README.md`](contracts/auction/README.md):

1. Install Rust + `wasm32-unknown-unknown` + Stellar CLI
2. `stellar contract build` inside `contracts/auction`
3. Deploy to testnet, resolve the native SAC address, call `initialize`
4. Copy the contract ID

### 2. Configure the frontend

```bash
cp .env.example .env.local
# set NEXT_PUBLIC_AUCTION_CONTRACT_ID=C...
```

### 3. Run the app

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Fund your wallet via [Stellar Laboratory Friendbot](https://laboratory.stellar.org/#account-creator?network=test) if needed.

## Project structure

```
stellar-payment-dapp/
├── app/                      # Next.js app router
├── components/
│   ├── AuctionApp.tsx        # layout + wallet + real-time orchestration
│   ├── auction/              # list, card, create, detail, feed, tx banner
│   ├── Section.tsx, Theme*
│   └── ui/                   # Toast, Confetti, …
├── lib/
│   ├── wallet.ts             # StellarWalletsKit (connect / sign)
│   ├── soroban.ts            # invoke / readView / getEvents
│   ├── auction.ts            # typed contract wrappers
│   └── stellar-helper.ts     # balance + explorer helpers (unchanged)
├── contracts/auction/        # Rust Soroban escrow contract
└── .env.example
```

## Level 2 checklist

- [x] 3+ error types handled (wallet, balance, bid-too-low / ended / self-bid)
- [x] Contract source ready for testnet deploy
- [x] Contract called from the frontend (create / bid / close + views)
- [x] Transaction status visible (pending / success / fail)
- [x] Real-time event integration (`getEvents` + live feed)

## Notes

- Amounts on-chain are **stroops** (`1 XLM = 10_000_000`).
- `lib/stellar-helper.ts` is left unmodified; bidding uses `lib/wallet.ts` + `lib/soroban.ts`.
- Built on Stellar **testnet**. No real funds involved.
