# 🌟 Stellar Frontend Starter Template

> **Build beautiful payment dashboards on Stellar blockchain - Focus only on UI/UX!**

All blockchain logic is already implemented with [Stellar Wallets Kit](https://github.com/Creit-Tech/Stellar-Wallets-Kit). Your job is to create an amazing user experience.

[![Stellar](https://img.shields.io/badge/Stellar-Testnet-blue)](https://stellar.org)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8)](https://tailwindcss.com)

## 🎯 What's This?

This is a **starter template** for building Stellar payment dashboards. Perfect for:
- 🎓 Learning Stellar blockchain development
- 🚀 Building your first blockchain app
- 💼 Creating payment interfaces quickly
- 🏆 Participating in hackathons

**No blockchain knowledge required!** All the complex blockchain logic is abstracted away in `lib/stellar-helper.ts` (DO NOT MODIFY). You only need to focus on creating beautiful UI/UX.

---

## ✨ Features

### ✅ Already Implemented (Ready to Use!)

- **Wallet Connection** - Connect with multiple Stellar wallets (Freighter, xBull, Albedo, etc.)
- **Balance Display** - View XLM balance with auto-refresh
- **Send Payments** - Send XLM with form validation
- **Transaction History** - View recent transactions with links to explorer
- **Responsive Design** - Mobile-friendly base components
- **Loading States** - Skeletons and spinners
- **Error Handling** - User-friendly error messages
- **TypeScript** - Full type safety

### 🎨 Bonus Features (Add These for Extra Credit!)

All components are in `components/BonusFeatures.tsx` with TODO comments:

- [ ] **Dark/Light Mode** (10 points) - Theme toggle
- [ ] **Copy Address** (5 points) - Already in WalletConnection!
- [ ] **QR Code** (10 points) - Generate QR for addresses
- [ ] **Balance Chart** (15 points) - Visualize balance history
- [ ] **Search Transactions** (10 points) - Filter transaction history
- [ ] **Multiple Assets** (15 points) - Support for other Stellar assets
- [ ] **Animations** (10 points) - Smooth transitions
- [ ] **Mobile Responsive** (10 points) - Perfect mobile experience
- [ ] **Transaction Confirmations** (10 points) - Confirm before sending
- [ ] **Address Book** (15 points) - Save frequent addresses

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** - [Download](https://nodejs.org/)
- **A Stellar Wallet** - Install one of these:
  - [Freighter](https://freighter.app) (Recommended)
  - [xBull](https://xbull.app)
  - [Lobstr](https://lobstr.co)
  - Or any other [supported wallet](https://github.com/Creit-Tech/Stellar-Wallets-Kit#compatible-wallets)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd stellar-frontend-challenge

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Get Testnet XLM

1. Connect your wallet
2. Copy your address
3. Visit [Stellar Laboratory](https://laboratory.stellar.org/#account-creator?network=test)
4. Paste your address and click "Fund"
5. Refresh your balance!

---

## 📁 Project Structure

```
stellar-frontend-challenge/
├── app/
│   ├── globals.css          # Global styles
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Main dashboard page
├── components/
│   ├── WalletConnection.tsx    # Wallet connect/disconnect
│   ├── BalanceDisplay.tsx      # Show XLM balance
│   ├── PaymentForm.tsx         # Send payment form
│   ├── TransactionHistory.tsx  # Transaction list
│   ├── BonusFeatures.tsx       # Bonus feature templates
│   └── example-components.tsx  # Reusable UI components
├── lib/
│   └── stellar-helper.ts    # ⚠️ DO NOT MODIFY - Blockchain logic
└── package.json
```

---

## 🎨 Customization Guide

### 1. Modify Existing Components

All components are in `components/` folder. They're well-commented and easy to customize:

```tsx
// Example: Change payment form layout in PaymentForm.tsx
<div className="space-y-4">
  <Input label="Recipient" ... />
  <Input label="Amount" ... />
  // Add your custom fields here!
</div>
```

### 2. Change Colors & Theme

Edit `app/globals.css` or Tailwind classes:

```tsx
// Change gradient colors in page.tsx
<div className="bg-gradient-to-br from-blue-500 to-purple-600">
  // Change these colors to match your brand!
</div>
```

### 3. Add Bonus Features

Check `components/BonusFeatures.tsx` for ready-to-use templates:

```tsx
import { ThemeToggle, AddressQRCode } from '@/components/BonusFeatures';

// Use in your page
<ThemeToggle />
<AddressQRCode address={publicKey} />
```

### 4. Use Example Components

Ready-made components in `example-components.tsx`:

```tsx
import { Card, Button, Input, Alert } from './example-components';

<Card title="My Feature">
  <Input label="Name" ... />
  <Button onClick={...}>Submit</Button>
</Card>
```

---

## 🛠️ Using the Stellar Helper

All blockchain operations are in `lib/stellar-helper.ts`. **DO NOT MODIFY THIS FILE!**

### Available Methods:

```typescript
import { stellar } from '@/lib/stellar-helper';

// Connect wallet (opens Stellar Wallets Kit modal)
const address = await stellar.connectWallet();

// Get balance
const { xlm, assets } = await stellar.getBalance(address);

// Send payment
const result = await stellar.sendPayment({
  from: senderAddress,
  to: recipientAddress,
  amount: "10.5",
  memo: "Payment for services"
});

// Get transaction history
const transactions = await stellar.getRecentTransactions(address, 10);

// Get explorer link
const link = stellar.getExplorerLink(txHash, 'tx');

// Format address (shorten)
const short = stellar.formatAddress(address, 4, 4); // "GABC...XYZ"

// Disconnect
stellar.disconnect();
```

---

## 🎓 Learning Resources

### Stellar Blockchain
- [Stellar Docs](https://developers.stellar.org/)
- [Stellar Laboratory](https://laboratory.stellar.org/)
- [Stellar Expert](https://stellar.expert/explorer/testnet) (Blockchain Explorer)

### Stellar Wallets Kit
- [GitHub Repository](https://github.com/Creit-Tech/Stellar-Wallets-Kit)
- [Documentation](https://stellarwalletskit.dev/)

### Frontend Technologies
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [React Icons](https://react-icons.github.io/react-icons/)

---

## 📊 Evaluation Criteria (If Using as Challenge)

### UI/UX Design (40%)
- Visual appeal and modern design
- User-friendly interface
- Consistent styling
- Good use of colors and typography
- Responsive layout

### Code Quality (30%)
- Clean, organized code
- Proper component structure
- TypeScript usage
- Comments where needed
- No console errors

### Functionality (30%)
- All required features work
- Proper error handling
- Loading states
- Edge cases handled

---

## 🚫 Important Rules

1. **DO NOT** modify `lib/stellar-helper.ts`
2. **DO NOT** write any blockchain/transaction logic yourself
3. **DO** focus on making the UI/UX amazing
4. **DO** use any CSS framework you like (Tailwind is pre-installed)
5. **DO** add extra features for bonus points
6. **DO** make it your own - be creative!

---

## 📦 Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 14.2.0 | React Framework |
| TypeScript | 5.4.5 | Type Safety |
| Tailwind CSS | 3.4.4 | Styling |
| Stellar SDK | 12.3.0 | Blockchain |
| Stellar Wallets Kit | 1.9.5 | Multi-Wallet Support |
| React Icons | 5.0.1 | Icon Library |

---

## 🤝 Contributing

This is a starter template! Feel free to:
- Fork and customize
- Share your creations
- Submit improvements via PR
- Report issues

---

## 📝 License

MIT License - Feel free to use this for learning, hackathons, or commercial projects!

---

## 💡 Tips for Success

1. **Start Simple** - Get basic features working first
2. **Test Often** - Use testnet XLM freely
3. **Read Comments** - All components have helpful comments
4. **Check Examples** - Look at `example-components.tsx` for inspiration
5. **Have Fun!** - Building on blockchain is exciting! 🚀

---

## 🆘 Troubleshooting

### Wallet won't connect?
- Make sure you have a Stellar wallet installed
- Check if you're on Testnet (not Mainnet)
- Try refreshing the page

### Balance shows 0?
- Fund your testnet account at [Stellar Laboratory](https://laboratory.stellar.org/#account-creator?network=test)
- Click the refresh button in BalanceDisplay

### Transaction fails?
- Check if you have enough XLM (keep at least 1 XLM as reserve)
- Verify the recipient address is valid
- Make sure you're on Testnet

### Build errors?
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## 🌟 Show Your Work!

Built something cool with this template? Share it!
- Tweet with #StellarDevelopers
- Share in [Stellar Discord](https://discord.gg/stellardev)
- Submit to [Stellar Community](https://stellar.org/community)

---

**Made with ❤️ for the Stellar Community**

Happy Building! 🚀✨
