/**
 * Stellar Payment Dashboard - Main Page
 * 
 * This is the main page that brings all components together.
 * All blockchain logic is in lib/stellar-helper.ts (DO NOT MODIFY)
 * 
 * Your job: Make this UI/UX amazing! 🎨
 */

'use client';

import { useState } from 'react';
import WalletConnection from '@/components/WalletConnection';
import BalanceDisplay from '@/components/BalanceDisplay';
import PaymentForm from '@/components/PaymentForm';
import TransactionHistory from '@/components/TransactionHistory';

export default function Home() {
  const [publicKey, setPublicKey] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleConnect = (key: string) => {
    setPublicKey(key);
    setIsConnected(true);
  };

  const handleDisconnect = () => {
    setPublicKey('');
    setIsConnected(false);
  };

  const handlePaymentSuccess = () => {
    // Refresh balance and transaction history
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900">
      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-sm bg-black/20">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-2xl">
                ⭐
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Stellar Dashboard</h1>
                <p className="text-white/60 text-sm">Testnet Payment Interface</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <a
                href="https://stellar.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/60 hover:text-white text-sm transition-colors"
              >
                About Stellar
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/60 hover:text-white text-sm transition-colors"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome Banner */}
        {!isConnected && (
          <div className="mb-8 bg-gradient-to-r from-blue-500/20 to-purple-600/20 border border-blue-500/30 rounded-2xl p-8 text-center">
            <h2 className="text-3xl font-bold text-white mb-3">
              Welcome to Stellar Payment Dashboard! 👋
            </h2>
            <p className="text-white/70 max-w-2xl mx-auto">
              Connect your wallet to view your balance, send XLM payments, and track your transaction history.
              All on Stellar's lightning-fast blockchain.
            </p>
          </div>
        )}

        {/* Wallet Connection */}
        <div className="mb-8">
          <WalletConnection onConnect={handleConnect} onDisconnect={handleDisconnect} />
        </div>

        {/* Dashboard Content - Only show when connected */}
        {isConnected && publicKey && (
          <div className="space-y-8">
            {/* Balance Section */}
            <div key={`balance-${refreshKey}`}>
              <BalanceDisplay publicKey={publicKey} />
            </div>

            {/* Two Column Layout for Payment Form and Transaction History */}
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Payment Form */}
              <div>
                <PaymentForm publicKey={publicKey} onSuccess={handlePaymentSuccess} />
              </div>

              {/* Transaction History */}
              <div key={`history-${refreshKey}`}>
                <TransactionHistory publicKey={publicKey} />
              </div>
            </div>

            {/* Info Cards */}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
                <div className="text-3xl mb-3">⚡</div>
                <h3 className="text-white font-semibold mb-2">Lightning Fast</h3>
                <p className="text-white/60 text-sm">
                  Transactions settle in 3-5 seconds on Stellar network
                </p>
              </div>

              <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
                <div className="text-3xl mb-3">💰</div>
                <h3 className="text-white font-semibold mb-2">Low Fees</h3>
                <p className="text-white/60 text-sm">
                  Transaction fees are just 0.00001 XLM (~$0.000001)
                </p>
              </div>

              <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
                <div className="text-3xl mb-3">🔒</div>
                <h3 className="text-white font-semibold mb-2">Secure</h3>
                <p className="text-white/60 text-sm">
                  Built on proven blockchain technology with wallet encryption
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Getting Started Guide - Only show when not connected */}
        {!isConnected && (
          <div className="mt-8 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4 text-2xl">
                1️⃣
              </div>
              <h3 className="text-white font-semibold mb-2">Install a Wallet</h3>
              <p className="text-white/60 text-sm">
                Choose any Stellar wallet: Freighter, xBull, Lobstr, Albedo, and more!
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4 text-2xl">
                2️⃣
              </div>
              <h3 className="text-white font-semibold mb-2">Connect</h3>
              <p className="text-white/60 text-sm">
                Click the connect button above and approve the connection request
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
              <div className="w-10 h-10 bg-pink-500/20 rounded-lg flex items-center justify-center mb-4 text-2xl">
                3️⃣
              </div>
              <h3 className="text-white font-semibold mb-2">Get Testnet XLM</h3>
              <p className="text-white/60 text-sm">
                Use Friendbot to fund your testnet account with free XLM
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
              <div className="w-10 h-10 bg-indigo-500/20 rounded-lg flex items-center justify-center mb-4 text-2xl">
                4️⃣
              </div>
              <h3 className="text-white font-semibold mb-2">Start Sending</h3>
              <p className="text-white/60 text-sm">
                Send XLM payments and track your transactions in real-time
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-16">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center text-white/40 text-sm">
            <p className="mb-2">
              Built with ❤️ using Stellar SDK | Running on Testnet
            </p>
            <p className="text-xs">
              ⚠️ This is a testnet application. Do not use real funds.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
