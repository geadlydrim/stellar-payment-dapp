/**
 * Soroban RPC helpers: invoke and read views for Marketplace adapters.
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

const server = new rpc.Server(SOROBAN_RPC_URL, { allowHttp: false });

export type TxStatus = 'pending' | 'success' | 'fail';

export interface InvokeResult {
  hash: string;
  status: TxStatus;
  returnValue?: unknown;
  error?: string;
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
 * Build, simulate, sign, submit, and poll a call against any contract.
 */
export async function invokeContract(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  caller: string
): Promise<InvokeResult> {
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
 * Simulate-only view call against any contract (no wallet signature).
 */
export async function readContractView(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = []
): Promise<unknown> {
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

export { server as sorobanServer };
