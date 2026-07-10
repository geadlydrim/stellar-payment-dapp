export interface RawTx {
  id: string;
  type: string;
  amount?: string;
  asset?: string;
  from?: string;
  to?: string;
  createdAt: string;
  hash: string;
}

export interface EnrichedTx extends RawTx {
  contractCall?: boolean;
}

const HORIZON_TESTNET = 'https://horizon-testnet.stellar.org';

async function enrichContractTx(tx: RawTx, publicKey: string): Promise<EnrichedTx> {
  if (tx.type !== 'invoke_host_function') return tx;

  try {
    const res = await fetch(`${HORIZON_TESTNET}/operations/${tx.id}`);
    const op = await res.json();
    const changes: Array<{
      asset_type: string;
      asset_code?: string;
      from?: string;
      to?: string;
      amount?: string;
    }> = op.asset_balance_changes || [];

    const change = changes.find((c) => c.from === publicKey || c.to === publicKey);
    if (!change) return { ...tx, contractCall: true };

    return {
      ...tx,
      amount: change.amount,
      asset: change.asset_type === 'native' ? 'XLM' : change.asset_code,
      from: change.from,
      to: change.to,
      contractCall: true,
    };
  } catch {
    return { ...tx, contractCall: true };
  }
}

export async function enrichHistory(txs: RawTx[], publicKey: string): Promise<EnrichedTx[]> {
  return Promise.all(txs.map((tx) => enrichContractTx(tx, publicKey)));
}
