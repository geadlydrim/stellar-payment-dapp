/**
 * Soroban RPC helpers: invoke, read views, poll events.
 */

import {
  Contract,
  TransactionBuilder,
  Account,
  rpc,
  scValToNative,
  xdr,
  BASE_FEE,
} from '@stellar/stellar-sdk';
import { NETWORK_PASSPHRASE, signTransaction } from './wallet';

export const SOROBAN_RPC_URL = 'https://soroban-testnet.stellar.org';
export const HORIZON_URL = 'https://horizon-testnet.stellar.org';

const server = new rpc.Server(SOROBAN_RPC_URL, { allowHttp: false });

export type TxStatus = 'pending' | 'success' | 'fail';

export interface InvokeResult {
  hash: string;
  status: TxStatus;
  returnValue?: unknown;
  error?: string;
}

function getContractId(): string {
  const id = process.env.NEXT_PUBLIC_AUCTION_CONTRACT_ID;
  if (!id) {
    throw new Error(
      'Missing NEXT_PUBLIC_AUCTION_CONTRACT_ID — deploy the contract and set it in .env.local'
    );
  }
  return id;
}

export function getAuctionContractId(): string {
  return getContractId();
}

async function loadAccount(address: string): Promise<Account> {
  const data = await server.getAccount(address);
  return new Account(data.accountId(), data.sequenceNumber());
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function pollTransaction(hash: string): Promise<{
  status: TxStatus;
  returnValue?: unknown;
  error?: string;
}> {
  for (let i = 0; i < 30; i++) {
    await sleep(1500);
    try {
      const tx = await server.getTransaction(hash);

      if (tx.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        let returnValue: unknown;
        try {
          if (tx.returnValue) {
            returnValue = scValToNative(tx.returnValue);
          }
        } catch {
          /* return value optional — tx already confirmed */
        }
        return { status: 'success', returnValue };
      }

      if (tx.status === rpc.Api.GetTransactionStatus.FAILED) {
        return {
          status: 'fail',
          error: 'Transaction failed on-chain',
        };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Protocol meta the SDK can't decode — tx likely already landed; confirm via raw RPC
      if (msg.includes('Bad union switch')) {
        const raw = await fetchRawTxStatus(hash);
        if (raw === 'SUCCESS') return { status: 'success' };
        if (raw === 'FAILED') {
          return { status: 'fail', error: 'Transaction failed on-chain' };
        }
        // NOT_FOUND / PENDING — keep polling
        continue;
      }
      throw err;
    }
  }
  return { status: 'fail', error: 'Timed out waiting for confirmation' };
}

/** Status-only check that avoids XDR meta decode (Protocol 23 safety net). */
async function fetchRawTxStatus(
  hash: string
): Promise<'SUCCESS' | 'FAILED' | 'NOT_FOUND' | 'PENDING' | null> {
  try {
    const res = await fetch(SOROBAN_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: { hash },
      }),
    });
    const json = (await res.json()) as {
      result?: { status?: string };
    };
    const status = json.result?.status;
    if (
      status === 'SUCCESS' ||
      status === 'FAILED' ||
      status === 'NOT_FOUND' ||
      status === 'PENDING'
    ) {
      return status;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Build, simulate, sign, submit, and poll a contract call.
 */
export async function invoke(
  method: string,
  args: xdr.ScVal[],
  caller: string
): Promise<InvokeResult> {
  const contractId = getContractId();
  const contract = new Contract(contractId);
  const account = await loadAccount(caller);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(180)
    .build();

  const prepared = await server.prepareTransaction(tx);
  const signedXdr = await signTransaction(prepared.toXDR());
  const signed = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

  const send = await server.sendTransaction(signed);

  if (send.status === 'ERROR') {
    return {
      hash: send.hash || '',
      status: 'fail',
      error: send.errorResult
        ? `Submit error: ${send.errorResult.toXDR('base64')}`
        : 'Transaction rejected by network',
    };
  }

  const hash = send.hash;
  const polled = await pollTransaction(hash);
  return { hash, ...polled };
}

/**
 * Simulate-only view call (no wallet signature).
 */
export async function readView(
  method: string,
  args: xdr.ScVal[] = []
): Promise<unknown> {
  const contractId = getContractId();
  const contract = new Contract(contractId);

  // Dummy source for simulation; views don't need real auth
  const dummy = new Account(
    'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    '0'
  );

  const tx = new TransactionBuilder(dummy, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);

  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error || 'Simulation failed');
  }
  if (rpc.Api.isSimulationSuccess(sim) && sim.result?.retval) {
    return scValToNative(sim.result.retval);
  }
  return null;
}

export interface ContractEvent {
  ledger: number;
  topics: string[];
  value: unknown;
  txHash?: string;
  ledgerClosedAt?: string;
  /** Stable id from RPC when available */
  id?: string;
}

/** How far back to scan on first load for the activity feed. */
export const EVENT_BACKFILL_LEDGERS = 5_000;

/**
 * Fetch contract events since a ledger (exclusive lower bound).
 * Pass `sinceLedger = 0` (or omit lookback) with `lookback` to backfill recent history.
 */
export async function getContractEvents(
  sinceLedger: number,
  options?: { lookback?: number; limit?: number }
): Promise<{ events: ContractEvent[]; latestLedger: number }> {
  const contractId = getContractId();

  const latest = await server.getLatestLedger();
  const lookback = options?.lookback ?? 10_000;
  const startLedger =
    sinceLedger <= 0
      ? Math.max(1, latest.sequence - (options?.lookback ?? EVENT_BACKFILL_LEDGERS))
      : Math.max(sinceLedger + 1, latest.sequence - lookback);

  if (startLedger > latest.sequence) {
    return { events: [], latestLedger: latest.sequence };
  }

  const response = await server.getEvents({
    startLedger,
    filters: [
      {
        type: 'contract',
        contractIds: [contractId],
      },
    ],
    limit: options?.limit ?? 50,
  });

  const events: ContractEvent[] = (response.events || []).map((ev) => {
    const topics: string[] = [];
    try {
      for (const t of ev.topic || []) {
        try {
          const native = scValToNative(t);
          topics.push(String(native));
        } catch {
          topics.push('?');
        }
      }
    } catch {
      /* ignore */
    }

    let value: unknown;
    try {
      value = ev.value ? scValToNative(ev.value) : null;
    } catch {
      value = null;
    }

    const raw = ev as {
      txHash?: string;
      ledgerClosedAt?: string;
      id?: string;
    };

    return {
      ledger: Number(ev.ledger),
      topics,
      value,
      txHash: raw.txHash,
      ledgerClosedAt: raw.ledgerClosedAt,
      id: raw.id,
    };
  });

  return {
    events,
    latestLedger: response.latestLedger ?? latest.sequence,
  };
}

export { server as sorobanServer };
