'use client';

import { useState, useMemo } from 'react';
import { stellar } from '@/lib/stellar-helper';
import { Section } from './Section';
import { WalletStep } from './steps/WalletStep';
import { BalanceStep } from './steps/BalanceStep';
import { SendStep } from './steps/SendStep';
import { HistoryStep, type HistoryRow } from './steps/HistoryStep';
import { Toast } from './ui/Toast';
import { Confetti, makeConfettiBurst } from './ui/Confetti';
import { ThemeToggle } from './ThemeToggle';

function friendlyLoadError(err: any): string {
  if (err?.name === 'NotFoundError' || err?.response?.status === 404) {
    return 'Account not found on testnet yet — fund it with Friendbot first.';
  }
  return 'Could not load. Try again?';
}

function shortAddress(addr: string): string {
  if (!addr) return '';
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function relativeTime(dateString: string): string {
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function DriftPay() {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [publicKey, setPublicKey] = useState('');
  const [connectError, setConnectError] = useState('');

  const [balance, setBalance] = useState(0);
  const [assets, setAssets] = useState<Array<{ code: string; issuer: string; balance: string }>>([]);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [balanceError, setBalanceError] = useState('');

  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyError, setHistoryError] = useState('');
  const [txDeltas, setTxDeltas] = useState<Array<number | null>>([]);

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [recipientError, setRecipientError] = useState('');
  const [amountError, setAmountError] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [lastTxHash, setLastTxHash] = useState('');
  const [lastSentTo, setLastSentTo] = useState('');

  const [toast, setToast] = useState<string | null>(null);
  const [confetti, setConfetti] = useState<ReturnType<typeof makeConfettiBurst>>([]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 3400);
  };

  const burstConfetti = () => {
    setConfetti(makeConfettiBurst());
    setTimeout(() => setConfetti([]), 1700);
  };

  const loadBalance = async (key: string) => {
    setBalanceLoading(true);
    setBalanceError('');
    try {
      const data = await stellar.getBalance(key);
      setBalance(parseFloat(data.xlm) || 0);
      setAssets(data.assets);
    } catch (err: any) {
      setBalanceError(friendlyLoadError(err));
    } finally {
      setBalanceLoading(false);
      setRefreshing(false);
    }
  };

  const loadHistory = async (key: string) => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const txs = await stellar.getRecentTransactions(key, 10);
      setTxDeltas(
        txs.map((tx) => {
          if (tx.type === 'create_account' || !tx.amount) return null;
          const outgoing = tx.from === key;
          const amt = parseFloat(tx.amount);
          return outgoing ? -amt : amt;
        })
      );
      setHistory(
        txs.map((tx) => {
          if (tx.type === 'create_account') {
            return {
              id: tx.id,
              outgoing: false,
              label: 'Account funded',
              time: relativeTime(tx.createdAt),
              counterparty: 'testnet funding',
              amountLabel: 'Funded',
            };
          }
          const outgoing = tx.from === key;
          const counterparty = outgoing ? tx.to : tx.from;
          return {
            id: tx.id,
            outgoing,
            label: outgoing ? 'Sent' : 'Received',
            time: relativeTime(tx.createdAt),
            counterparty: shortAddress(counterparty || ''),
            amountLabel: tx.amount
              ? `${outgoing ? '-' : '+'}${parseFloat(tx.amount).toFixed(2)} ${tx.asset || 'XLM'}`
              : '—',
          };
        })
      );
    } catch (err: any) {
      setHistoryError(friendlyLoadError(err));
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    setConnectError('');
    try {
      const key = await stellar.connectWallet();
      setPublicKey(key);
      setConnected(true);
      showToast('Wallet connected');
      loadBalance(key);
      loadHistory(key);
    } catch (err: any) {
      setConnectError(err.message || 'Could not connect. Try again?');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    stellar.disconnect();
    setConnected(false);
    setPublicKey('');
    setBalance(0);
    setAssets([]);
    setHistory([]);
    setTxDeltas([]);
    setLastTxHash('');
    setLastSentTo('');
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadBalance(publicKey);
  };

  const validateSend = (): boolean => {
    let rErr = '';
    let aErr = '';
    if (!recipient.trim()) rErr = 'Add a recipient address';
    else if (recipient.length !== 56 || !recipient.startsWith('G'))
      rErr = 'Should start with G, 56 characters';

    const num = parseFloat(amount);
    if (!amount.trim()) aErr = 'Add an amount';
    else if (isNaN(num) || num <= 0) aErr = 'Must be a positive number';
    else if (num > balance) aErr = "That's more than you have";

    setRecipientError(rErr);
    setAmountError(aErr);
    return !rErr && !aErr;
  };

  const submitSend = async () => {
    setSendError('');
    setSending(true);
    try {
      const res = await stellar.sendPayment({
        from: publicKey,
        to: recipient,
        amount,
        memo: memo || undefined,
      });

      if (res.success) {
        setLastTxHash(res.hash);
        setLastSentTo(recipient);
        setRecipient('');
        setAmount('');
        setMemo('');
        showToast('Payment sent');
        burstConfetti();
        loadBalance(publicKey);
        loadHistory(publicKey);
      } else {
        setSendError('Transaction did not confirm. Try again.');
      }
    } catch (err: any) {
      let msg = 'Payment failed. ';
      if (err.message?.includes('insufficient')) msg += 'Insufficient balance.';
      else if (err.message?.includes('destination')) msg += 'Invalid destination account.';
      else msg += err.message || 'Please try again.';
      setSendError(msg);
    } finally {
      setSending(false);
    }
  };

  const balancePoints = useMemo(() => {
    let running = balance;
    const pts = [running];
    for (const d of txDeltas) {
      if (d === null) break;
      running -= d;
      pts.push(running);
    }
    return pts.reverse();
  }, [balance, txDeltas]);

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          'linear-gradient(180deg, var(--qf-bg-1), var(--qf-bg-2) 60%, var(--qf-bg-1))',
      }}
    >
      <header className="sticky top-0 z-20 bg-[var(--qf-header-bg)] backdrop-blur-2xl border-b border-[var(--qf-card-border)]">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#5EEAD4] to-[#0D9488] flex items-center justify-center text-lg flex-shrink-0">
              🌊
            </div>
            <div className="min-w-0">
              <p className="font-poppins font-semibold text-[17px] text-[var(--qf-text-1)] truncate">DriftPay</p>
              <p className="hidden sm:block text-[11.5px] text-[var(--qf-text-3)]">Your Stellar wallet</p>
            </div>
          </div>
          <nav className="flex items-center gap-4 sm:gap-6 flex-shrink-0">
            <a
              href="https://stellar.org"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex text-[13.5px] text-[var(--qf-text-2)] whitespace-nowrap flex-shrink-0"
            >
              About Stellar
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex text-[13.5px] text-[var(--qf-text-2)] whitespace-nowrap flex-shrink-0"
            >
              GitHub
            </a>
            {connected && (
              <span className="font-mono text-xs text-[var(--qf-text-3)] bg-[var(--qf-input-bg)] border border-[var(--qf-card-border)] py-[7px] px-3 rounded-full whitespace-nowrap flex-shrink-0">
                {shortAddress(publicKey)}
              </span>
            )}
            <ThemeToggle />
          </nav>
        </div>
      </header>

      {!connected && (
        <div className="max-w-[680px] mx-auto px-4 sm:px-6 pt-14 pb-2 text-center">
          <h1 className="mb-3.5 font-poppins font-bold text-[clamp(30px,4vw,42px)] leading-[1.15] text-[var(--qf-text-1)]">
            Your money, on Stellar.
          </h1>
          <p className="mx-auto max-w-[480px] text-base leading-relaxed text-[var(--qf-text-2)]">
            Connect a wallet to check your balance, send payments, and keep track of your
            activity — fast, low-cost, and yours to control.
          </p>
        </div>
      )}

      <main className="max-w-[600px] mx-auto px-4 sm:px-6 pt-12 pb-10">
        <div className="flex flex-col gap-[18px]">
          <Section>
            <WalletStep
              connected={connected}
              connecting={connecting}
              error={connectError}
              publicKey={publicKey}
              shortAddress={shortAddress(publicKey)}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
            />
          </Section>

          <Section
            disabled={!connected}
            action={
              connected && (
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="border-none bg-transparent cursor-pointer text-[var(--qf-text-3)] text-[12.5px] flex items-center gap-1.5"
                >
                  <span className={refreshing ? 'animate-spin inline-block' : 'inline-block'}>↻</span>{' '}
                  refresh
                </button>
              )
            }
          >
            <BalanceStep
              disabled={!connected}
              loading={balanceLoading}
              balance={balance}
              assets={assets}
              error={balanceError}
              balancePoints={balancePoints}
            />
          </Section>

          <Section disabled={!connected}>
            <SendStep
              disabled={!connected}
              recipient={recipient}
              amount={amount}
              memo={memo}
              recipientError={recipientError}
              amountError={amountError}
              sending={sending}
              sendError={sendError}
              lastTxHash={lastTxHash}
              lastSentTo={lastSentTo}
              explorerLink={(hash) => stellar.getExplorerLink(hash, 'tx')}
              onRecipientChange={(v) => {
                setRecipient(v);
                setRecipientError('');
              }}
              onAmountChange={(v) => {
                setAmount(v);
                setAmountError('');
              }}
              onMemoChange={setMemo}
              onValidate={validateSend}
              onConfirmSend={submitSend}
            />
          </Section>

          <Section disabled={!connected}>
            <HistoryStep
              disabled={!connected}
              loading={historyLoading}
              history={history}
              error={historyError}
            />
          </Section>
        </div>
      </main>

      <footer className="border-t border-[var(--qf-card-border)] mt-6">
        <div className="max-w-[1100px] mx-auto px-6 py-8 text-center">
          <p className="mb-1.5 text-[12.5px] text-[var(--qf-text-4)]">Currently running on Stellar testnet · no real funds</p>
          <p className="text-xs text-[var(--qf-text-4)]">DriftPay is in early access</p>
        </div>
      </footer>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
      <Confetti particles={confetti} />
    </div>
  );
}
