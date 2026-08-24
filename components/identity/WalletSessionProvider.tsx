'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { resolveMarketAdapterKind, type MarketAdapterKind } from '@/lib/adapters';
import {
  connect as walletConnect,
  disconnect as walletDisconnect,
  getAddress,
  getPublicKey,
} from '@/lib/wallet';
import {
  isStellarPublicKey,
  resolveOwnerId,
  type SessionOwner,
} from '@/lib/identity/owner';

export type WalletSessionValue = {
  adapter: MarketAdapterKind;
  publicKey: string | null;
  hydrated: boolean;
  connecting: boolean;
  session: SessionOwner | null;
  connect: () => Promise<string>;
  disconnect: () => void;
};

const WalletSessionContext = createContext<WalletSessionValue | null>(null);

function asWalletKey(value: string | null | undefined): string | null {
  const key = value?.trim() ?? '';
  return isStellarPublicKey(key) ? key : null;
}

export function WalletSessionProvider({ children }: { children: ReactNode }) {
  const adapter = resolveMarketAdapterKind();
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(adapter !== 'stellar');
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (adapter !== 'stellar') {
      setPublicKey(null);
      setHydrated(true);
      return;
    }
    void (async () => {
      const wallet = getPublicKey() ?? (await getAddress());
      setPublicKey(asWalletKey(wallet));
      setHydrated(true);
    })();
  }, [adapter]);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const key = await walletConnect();
      const next = asWalletKey(key);
      setPublicKey(next);
      if (!next) {
        throw new Error('Wallet connection failed — no address returned');
      }
      return next;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    walletDisconnect();
    setPublicKey(null);
  }, []);

  const session = useMemo(
    () => resolveOwnerId({ adapter, publicKey }),
    [adapter, publicKey]
  );

  const value = useMemo<WalletSessionValue>(
    () => ({
      adapter,
      publicKey,
      hydrated,
      connecting,
      session,
      connect,
      disconnect,
    }),
    [adapter, publicKey, hydrated, connecting, session, connect, disconnect]
  );

  return (
    <WalletSessionContext.Provider value={value}>
      {children}
    </WalletSessionContext.Provider>
  );
}

export function useWalletSession(): WalletSessionValue {
  const ctx = useContext(WalletSessionContext);
  if (!ctx) {
    throw new Error('useWalletSession must be used inside WalletSessionProvider');
  }
  return ctx;
}
