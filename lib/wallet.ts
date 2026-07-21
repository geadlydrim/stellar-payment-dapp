/**
 * Shared Stellar Wallets Kit instance for signing arbitrary Soroban XDR.
 * Separate from stellar-helper.ts (which keeps its kit private).
 */

import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
  FREIGHTER_ID,
} from '@creit.tech/stellar-wallets-kit';
import { Networks } from '@stellar/stellar-sdk';

export const NETWORK_PASSPHRASE = Networks.TESTNET;

let kit: StellarWalletsKit | null = null;
let publicKey: string | null = null;

function getKit(): StellarWalletsKit {
  if (!kit) {
    kit = new StellarWalletsKit({
      network: WalletNetwork.TESTNET,
      selectedWalletId: FREIGHTER_ID,
      modules: allowAllModules(),
    });
  }
  return kit;
}

export async function connect(): Promise<string> {
  const k = getKit();
  await k.openModal({
    onWalletSelected: async (option) => {
      k.setWallet(option.id);
    },
  });

  const { address } = await k.getAddress();
  if (!address) {
    throw new Error('Wallet connection failed — no address returned');
  }
  publicKey = address;
  return address;
}

export async function getAddress(): Promise<string | null> {
  if (publicKey) return publicKey;
  try {
    const { address } = await getKit().getAddress();
    publicKey = address || null;
    return publicKey;
  } catch {
    return null;
  }
}

export async function signTransaction(xdr: string): Promise<string> {
  const { signedTxXdr } = await getKit().signTransaction(xdr, {
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  return signedTxXdr;
}

export function disconnect(): void {
  publicKey = null;
}

export function getPublicKey(): string | null {
  return publicKey;
}
