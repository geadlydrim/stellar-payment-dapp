# DriftPay

A Stellar testnet wallet dashboard — connect, check your balance, send XLM, and keep an eye on your activity. Built on top of the [Stellar Frontend Starter Template](https://github.com/Creit-Tech/Stellar-Wallets-Kit).

[![Stellar](https://img.shields.io/badge/Stellar-Testnet-blue)](https://stellar.org)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8)](https://tailwindcss.com)

## What it is

DriftPay is a single-page wallet dashboard for the Stellar network. Connect a wallet (Freighter, xBull, Albedo, or anything else Stellar Wallets Kit supports), see your balance update live, send XLM to another address, and browse your recent activity — including transactions that went through a smart contract instead of a plain payment.

It's built as a series of cards that only "wake up" once a wallet is connected: Wallet → Balance → Send → History, stacked vertically, all sharing one theme.

## Core features

- **Wallet connection** — multi-wallet support via Stellar Wallets Kit, with a short address chip, copy-to-clipboard, and a toggleable QR code once connected.
- **Balance** — animated count-up when it changes, a quick flash so you notice updates, a sparkline showing recent trend, and a breakdown of any non-XLM assets you're holding.
- **Send payments** — recipient/amount/memo form with validation, a review-before-you-send confirmation step, and a success state that shows the full transaction hash plus a one-click link to Stellar Expert.
- **Transaction history** — recent activity with relative timestamps ("3m ago"), live search/filter, and loading skeletons while it fetches.
- **Address book** — save addresses with a label, pick them straight into the send form, and get prompted to save a new address right after you send to it.

## Bonus features

- ✅ **Theming** — not just dark/light. Two full palettes (Sherbet and Mint Fog), each with its own day/night mode, picked from swatches in the header and persisted across visits.
- ✅ **Copy address** — one click, with a checkmark confirmation.
- ✅ **QR code** — generated on demand for your connected address.
- ✅ **Balance chart** — a lightweight sparkline built from recent transaction deltas, no charting library needed.
- ✅ **Search transactions** — filter history by counterparty, label, or amount as you type.
- ✅ **Multiple assets** — non-native balances show up under "Other assets" automatically.
- ✅ **Animations** — breathing call-to-action buttons, fade-ups on cards and rows, a confetti burst on successful sends, a checkmark pop on confirm.
- ✅ **Mobile responsive** — the whole layout collapses cleanly down to a single column.
- ✅ **Transaction confirmations** — nothing sends until you've reviewed recipient, amount, and memo on a dedicated confirm screen.
- ✅ **Address book** — save, pick, and remove addresses, with a "save this address?" nudge after sending somewhere new.
- ✅ **Contract-aware history** — Horizon's payments feed returns blank `from`/`to`/`amount` for transactions that route through a Soroban contract instead of a plain payment op. DriftPay detects those and enriches them by reading the operation's asset balance changes directly, so a contract-routed send still shows up correctly labeled ("Sent (contract)") with the real amount and counterparty, instead of a broken "Received / —" row.

## Tech stack

| Technology | Purpose |
|------------|---------|
| Next.js 14 (App Router) | React framework |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| Stellar SDK | Blockchain interaction |
| Stellar Wallets Kit | Multi-wallet support |
| `qrcode` | Client-side QR generation |

## Getting started

### Prerequisites

- Node.js 18+
- A Stellar wallet extension — [Freighter](https://freighter.app) is the easiest to start with

### Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Get testnet XLM

1. Connect your wallet in the app
2. Copy your address (there's a copy button right next to it)
3. Head to [Stellar Laboratory](https://laboratory.stellar.org/#account-creator?network=test) and fund it
4. Hit refresh on the balance card

## Project structure

```
stellar-payment-dapp/
├── app/
│   ├── globals.css          # theme tokens (all 4 palette × mode combos), keyframes
│   ├── layout.tsx           # fonts, theme init script
│   └── page.tsx             # entry point
├── components/
│   ├── DriftPay.tsx          # top-level layout + state orchestration
│   ├── ThemeProvider.tsx     # palette/mode context + persistence
│   ├── ThemeToggle.tsx       # header swatch picker + day/night toggle
│   ├── Section.tsx            # shared card shell
│   ├── AddressBook.tsx        # saved-address chips + add/remove flow
│   ├── steps/
│   │   ├── WalletStep.tsx     # connect/disconnect, address, QR
│   │   ├── BalanceStep.tsx    # balance, sparkline, other assets
│   │   ├── SendStep.tsx       # send form, confirm step, success/error state
│   │   └── HistoryStep.tsx    # activity list + search
│   └── ui/
│       ├── Toast.tsx, Confetti.tsx, CopyButton.tsx, QRCode.tsx, Sparkline.tsx
├── lib/
│   ├── stellar-helper.ts    # blockchain logic (do not modify)
│   ├── txEnrich.ts          # fills in contract-routed transaction data
│   ├── addressBook.ts       # localStorage-backed address book
│   └── useCountUp.ts        # animated number hook
└── package.json
```

## Screenshots

**Connect wallet**

**Balance + sparkline**

**Send flow — confirm step**

**Send flow — success**

**Transaction history + search**

**Address book**

**Sherbet theme, day mode**

**Sherbet theme, night mode**

**Mint Fog theme, day mode**

**Mint Fog theme, night mode**

**Mobile view**

---

Built on Stellar testnet. No real funds involved.
