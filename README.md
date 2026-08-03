# Stellar4

Play **Stellar4**, then list items on **Stellar4 Marketplace** — fixed-price sale, auction, or offer-board trade on Stellar — without rewriting the game.

[![Stellar](https://img.shields.io/badge/Stellar-Testnet-blue)](https://stellar.org)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org)
[![Soroban](https://img.shields.io/badge/Soroban-Contracts-purple)](https://developers.stellar.org/docs/build/smart-contracts)
[![CI](https://github.com/geadlydrim/stellar-payment-dapp/actions/workflows/ci.yml/badge.svg)](https://github.com/geadlydrim/stellar-payment-dapp/actions/workflows/ci.yml)

**Demo:** _https://bid-drift.vercel.app/_ (legacy auction surface at `/`; game + marketplace at `/play` and `/market`)

## Surfaces

| Route | Product |
|-------|---------|
| `/play` | **Stellar4** — play loop, inventory, equip / use items |
| `/market` | **Stellar4 Marketplace** — Sale · Auction · Trade tabs |
| `/` | Legacy live auction board (XLM escrow on testnet) |

An item is either **usable in-game** or **tradable as an NFT** — never both. Export from Play → list on Marketplace → settle → import back to Play.

Marketplace currently runs on **mock adapters** (`NEXT_PUBLIC_MARKET_ADAPTER=mock`). Point env at deployed contract IDs and flip to `stellar` once Integration adapters land.

## Features

- **Stellar4 play** — spin for items, inventory, equip weapons, use charms; responsive `/play`
- **Marketplace** — Sale (fixed price), Auction (escrow bids), Trade (offer board with accept/reject)
- **Export / import** — lock → NFT → list; cancel or settle → redeem back in-game
- **Legacy auction** — multi-wallet connect, XLM escrow bids, settle on close, live Soroban event feed
- **Error & loading states** — wallet, balance, listing, bid, and offer paths surface plain-language failures

## Getting started

### Prerequisites

- Node.js 18+ (20 recommended)
- Optional for on-chain work: [Rust](https://rustup.rs), [Stellar CLI](https://developers.stellar.org/docs/tools/cli), a funded testnet identity
- A Stellar wallet extension — [Freighter](https://freighter.app) for the legacy auction board

### Run locally

```bash
cp .env.example .env.local
# leave NEXT_PUBLIC_MARKET_ADAPTER=mock for game + marketplace without deploy IDs

npm install
npm run dev
```

Open [http://localhost:3000/play](http://localhost:3000/play) or [http://localhost:3000/market](http://localhost:3000/market).

### Tests

```bash
npm test                 # frontend (registry + mock ports) — expect 18
cd contracts && cargo test   # Soroban unit tests — expect 14
```

CI runs the same commands (plus lint, typecheck, and `npm run build`) — see [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

### Get testnet XLM

1. Connect your wallet on `/`
2. Copy your address from the header
3. Fund it at [Stellar Laboratory Friendbot](https://laboratory.stellar.org/#account-creator?network=test)

## Deploy contracts (testnet)

**Order matters:** deploy and initialize **`item-nft` first**, then auction / fixed-price / offer-board (each takes the NFT contract id).

| Step | Crate | Notes |
|------|-------|--------|
| 1 | [`contracts/item-nft`](contracts/item-nft/README.md) | `initialize` + optional `set_minter` for the bridge key |
| 2 | [`contracts/auction`](contracts/auction/README.md) | **Redeploy** for NFT settle — storage layout changed; do not reuse an old BidDrift auction ID for Marketplace Auction |
| 3 | [`contracts/fixed-price`](contracts/fixed-price/README.md) | `initialize` with native SAC + `item-nft` id |
| 4 | [`contracts/offer-board`](contracts/offer-board/README.md) | Same: native SAC + `item-nft` id |

Workspace overview, env placeholders, and event topics: [`contracts/README.md`](contracts/README.md).

### Secrets (never commit)

| Secret | Where | Purpose |
|--------|-------|---------|
| Deploy identity seed / secret key | Stellar CLI keystore only (`stellar keys`) — **not** in git or `.env.local` | Sign `deploy` / `invoke` |
| `.env.local` | Local / host secrets store | Contract IDs + `NEXT_PUBLIC_*` (public to the browser; still don’t commit) |
| GitHub Actions | Not required for current CI (tests only; no deploy job yet) | Add later if you automate deploy |

After deploy, copy the `C…` contract IDs into `.env.local` (see `.env.example`). Keep `NEXT_PUBLIC_MARKET_ADAPTER=mock` until Integration wires `lib/adapters/stellar/`.

**Auction migration callout:** Marketplace Auction must use the **redeployed** NFT-capable auction. Legacy `/` can keep the old contract until cutover. Details in [`contracts/auction/README.md`](contracts/auction/README.md).

### Dalek pin (contracts)

If `cargo update` pulls `ed25519-dalek` 3.x and Soroban 22 testutils break, re-pin:

```bash
cd contracts
cargo update -p ed25519-dalek@3.0.0 --precise 2.2.0
```

## Screenshots

**Connect wallet**

<img width="1100" alt="Screenshot From 2026-07-22 22-59-45" src="https://github.com/user-attachments/assets/af11ca45-4fa7-4c1d-ad66-fc86a1400b04" />

**Auction list + live activity**

<img width="1100" alt="image" src="https://github.com/user-attachments/assets/e3201ed7-0ef4-48fc-bd50-db237b1a168a" />

**Create auction — transaction status**

<img width="330" alt="image" src="https://github.com/user-attachments/assets/7ce8c6d2-5937-4044-b1aa-bb7ae62e86ae" />
<img width="330" alt="image" src="https://github.com/user-attachments/assets/6504042f-9164-4f70-890e-b3e9c11a3e11" />

**Place bid — success**

<img width="500" alt="Screenshot From 2026-07-22 23-08-56" src="https://github.com/user-attachments/assets/1449fef9-f280-4b23-bb27-675f9709e598" />

**Mobile**

<img width="240" alt="Screenshot From 2026-07-22 23-12-21" src="https://github.com/user-attachments/assets/d739a038-8787-41c9-ac0b-0ebe8df9c206" />
<img width="240" alt="Screenshot From 2026-07-22 23-13-03" src="https://github.com/user-attachments/assets/3a0edff5-4fa2-46ad-b8b8-927a6175b3f8" />

## Tech stack

| Technology | Purpose |
|------------|---------|
| Next.js 14 (App Router) | React frontend |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| `@stellar/stellar-sdk` | Horizon + Soroban RPC (legacy auction) |
| Stellar Wallets Kit | Multi-wallet signing |
| Soroban (Rust) | item-nft, auction, fixed-price, offer-board |

## Project structure

```
stellar-payment-dapp/
├── app/play/                 # Stellar4 game
├── app/market/               # Stellar4 Marketplace
├── app/page.tsx              # Legacy auction board
├── components/game/          # Play / inventory UI
├── components/market/        # Sale / Auction / Trade
├── components/auction/       # Legacy auction UI
├── lib/
│   ├── game/                 # Game services (no Stellar)
│   ├── registry/             # Item store + state machine
│   ├── ports/                # NftBridge + market ports
│   └── adapters/mock/        # Mock market until stellar adapters
├── contracts/                # Soroban workspace
└── .github/workflows/ci.yml  # Frontend + contract tests
```

---

Built on Stellar testnet. No real funds involved.
