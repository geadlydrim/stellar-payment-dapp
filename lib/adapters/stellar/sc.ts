import { Address, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import {
  invokeContract,
  readContractView,
  type InvokeResult,
} from '@/lib/soroban';
import { PortError } from '@/lib/adapters/helpers';

export const STROOPS_PER_XLM = 10_000_000;

export function addressScVal(addr: string): xdr.ScVal {
  return Address.fromString(addr).toScVal();
}

export function i128ScVal(n: bigint): xdr.ScVal {
  return nativeToScVal(n, { type: 'i128' });
}

export function u64ScVal(n: number | bigint): xdr.ScVal {
  return nativeToScVal(BigInt(n), { type: 'u64' });
}

export function u32ScVal(n: number): xdr.ScVal {
  return nativeToScVal(n, { type: 'u32' });
}

export function stringScVal(s: string): xdr.ScVal {
  return nativeToScVal(s, { type: 'string' });
}

export function u32VecScVal(ids: number[]): xdr.ScVal {
  return xdr.ScVal.scvVec(ids.map((id) => u32ScVal(id)));
}

export function xlmToStroops(xlm: number | string): bigint {
  const n = typeof xlm === 'string' ? parseFloat(xlm) : xlm;
  if (isNaN(n) || n < 0) throw new PortError('Invalid XLM amount');
  return BigInt(Math.round(n * STROOPS_PER_XLM));
}

export function stroopsToXlm(stroops: number | bigint): string {
  const n = typeof stroops === 'bigint' ? Number(stroops) : stroops;
  return (n / STROOPS_PER_XLM).toFixed(7).replace(/\.?0+$/, '') || '0';
}

export async function invokeOrThrow(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  caller: string
): Promise<InvokeResult> {
  const result = await invokeContract(contractId, method, args, caller);
  if (result.status !== 'success') {
    throw new PortError(result.error || `${method} failed on-chain`);
  }
  return result;
}

export async function viewOrThrow(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = []
): Promise<unknown> {
  try {
    return await readContractView(contractId, method, args);
  } catch (e) {
    throw new PortError(
      e instanceof Error ? e.message : `${method} view failed`
    );
  }
}

/** Stellar account id (G…) used as owner/seller/buyer on-chain. */
export function assertStellarAddress(addr: string, label = 'address'): void {
  if (!/^G[A-Z0-9]{55}$/.test(addr)) {
    throw new PortError(
      `${label} must be a Stellar public key (G…) for the stellar adapter — got "${addr}"`
    );
  }
}
