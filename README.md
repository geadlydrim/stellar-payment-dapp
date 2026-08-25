# Stellar4

Play **Stellar4**, then list items on **Stellar4 Marketplace** — fixed-price sale, auction, or offer-board trade on Stellar — without rewriting the game.

[![Stellar](https://img.shields.io/badge/Stellar-Testnet-blue)](https://stellar.org)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org)
[![Soroban](https://img.shields.io/badge/Soroban-Contracts-purple)](https://developers.stellar.org/docs/build/smart-contracts)
[![CI](https://github.com/geadlydrim/stellar-payment-dapp/actions/workflows/ci.yml/badge.svg)](https://github.com/geadlydrim/stellar-payment-dapp/actions/workflows/ci.yml)

**Demo:** _https://bid-drift.vercel.app/_ (landing at `/`; game `/play`; marketplace `/market`)

## Surfaces

| Route | Product |
|-------|---------|
| `/` | Landing — choose Play or Marketplace |
| `/play` | **Stellar4** — play loop, inventory, equip / use items |
| `/market` | **Stellar4 Marketplace** — Sale · Auction · Trade tabs |

An item is either **usable in-game** or **tradable as an NFT** — never both. Export from Play → list on Marketplace → settle → import back to Play.

Marketplace currently runs on **mock adapters** (`NEXT_PUBLIC_MARKET_ADAPTER=mock`). Point env at deployed contract IDs and flip to `stellar` once Integration adapters land.

## Features

- **Stellar4 play** — spin for items, inventory, equip weapons, use charms; responsive `/play`
- **Marketplace** — Sale (fixed price), Auction (escrow bids), Trade (offer board with accept/reject)
- **Export / import** — lock → NFT → list; cancel or settle → redeem back in-game
- **Error & loading states** — wallet, listing, bid, and offer paths surface plain-language failures

## Getting started

### Prerequisites

- Node.js 18+ (20 recommended)
- Optional for on-chain work: [Rust](https://rustup.rs), [Stellar CLI](https://developers.stellar.org/docs/tools/cli), a funded testnet identity
- A Stellar wallet extension — [Freighter](https://freighter.app) for Play and Marketplace

### Run locally

```bash
cp .env.example .env.local
# leave NEXT_PUBLIC_MARKET_ADAPTER=mock for game + marketplace without deploy IDs

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), then Play or Marketplace.

### Tests

```bash
npm test                 # frontend unit tests (registry, adapters, identity)
cd contracts && cargo test   # Soroban unit tests
```

CI runs the same commands (plus lint, typecheck, and `npm run build`) — see [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

### Get testnet XLM

1. Connect your wallet on `/play` or `/market`
2. Copy your address from the header
3. Fund it at [Stellar Laboratory Friendbot](https://laboratory.stellar.org/#account-creator?network=test)

## Deploy contracts (testnet)

**Order matters:** deploy and initialize **`item-nft` first**, then auction / fixed-price / offer-board (sale and trade bake `nft_contract` at `initialize`).

Players **self-mint** (`mint(signer, signer, item_id)`). Do **not** run `set_minter` for every Freighter wallet. `set_minter` is optional and only for mint-to-other / airdrop.

item-nft has **no upgrade** entrypoint. A new WASM is a new `C…`. Redeploy fixed-price and offer-board against that NFT id; auction can keep its ID (each listing passes `nft_contract`). Tokens on the previous item-nft `C…` are abandoned.

| Step | Crate | Notes |
|------|-------|--------|
| 1 | [`contracts/item-nft`](contracts/item-nft/README.md) | `initialize(admin)`. Players self-mint; optional `set_minter` only for mint-to-other / airdrop |
| 2 | [`contracts/auction`](contracts/auction/README.md) | **Redeploy** for NFT settle — storage layout changed; do not reuse an old XLM-only auction ID for Marketplace Auction |
| 3 | [`contracts/fixed-price`](contracts/fixed-price/README.md) | `initialize` with native SAC + **current** `item-nft` id |
| 4 | [`contracts/offer-board`](contracts/offer-board/README.md) | Same: native SAC + **current** `item-nft` id |

Workspace overview, env placeholders, and event topics: [`contracts/README.md`](contracts/README.md).

### Secrets (never commit)

| Secret | Where | Purpose |
|--------|-------|---------|
| Deploy identity seed / secret key | Stellar CLI keystore only (`stellar keys`) — **not** in git or `.env.local` | Sign `deploy` / `invoke` |
| `.env.local` | Local / host secrets store | Contract IDs + `NEXT_PUBLIC_*` (public to the browser; still don’t commit) |
| GitHub Actions | Not required for current CI (tests only; no deploy job yet) | Add later if you automate deploy |

After deploy, copy the `C…` contract IDs into `.env.local` (see `.env.example`) and set `NEXT_PUBLIC_MARKET_ADAPTER=stellar`. Restart `npm run dev` after changing env. Players do not need `set_minter` to export.

**Auction:** Marketplace Auction must use the **NFT-capable** auction deploy (storage layout changed vs the original XLM-only contract). Details in [`contracts/auction/README.md`](contracts/auction/README.md).

### Dalek pin (contracts)

If `cargo update` pulls `ed25519-dalek` 3.x and Soroban 22 testutils break, re-pin:

```bash
cd contracts
cargo update -p ed25519-dalek@3.0.0 --precise 2.2.0
```

## Tech stack

| Technology | Purpose |
|------------|---------|
| Next.js 14 (App Router) | React frontend |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| `@stellar/stellar-sdk` | Horizon + Soroban RPC |
| Stellar Wallets Kit | Multi-wallet signing |
| Soroban (Rust) | item-nft, auction, fixed-price, offer-board |

## Project structure

```
stellar-payment-dapp/
├── app/play/                 # Stellar4 game
├── app/market/               # Stellar4 Marketplace
├── app/page.tsx              # Landing (Play vs Market)
├── components/game/          # Play / inventory UI
├── components/market/        # Sale / Auction / Trade
├── lib/
│   ├── game/                 # Game services (no Stellar)
│   ├── registry/             # Item store + state machine
│   ├── ports/                # NftBridge + market ports
│   └── adapters/             # mock + stellar market adapters
├── contracts/                # Soroban workspace
└── .github/workflows/ci.yml  # Frontend + contract tests
```

---

Built on Stellar testnet. No real funds involved.
