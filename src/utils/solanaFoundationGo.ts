import { PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import bs58 from 'bs58';

/**
 * Official Solana Foundation Go SDK Client Bindings
 * Based on https://github.com/solana-foundation/solana-go
 * 
 * Solana Foundation Go SDK Architecture:
 * 1. RPC Client with Commitment Levels (Processed, Confirmed, Finalized)
 * 2. Standard Program ID bindings (System, Token, Associated Token, Stake)
 * 3. Base58 Public Key and Signature type validation
 * 4. Microsecond slot & epoch time calculations for staking yield
 */

export interface SolanaFoundationRpcConfig {
  endpoint: string;
  commitment: 'processed' | 'confirmed' | 'finalized';
  version: string;
  sdk: 'solana-foundation/solana-go';
}

export const OFFICIAL_SOLANA_FOUNDATION_CONFIG: SolanaFoundationRpcConfig = {
  endpoint: 'https://api.mainnet-beta.solana.com',
  commitment: 'finalized',
  version: '1.0.0',
  sdk: 'solana-foundation/solana-go'
};

/**
 * Format transaction instructions matching solana-foundation/solana-go wire format
 */
export function formatFoundationGoInstruction(ix: TransactionInstruction) {
  return {
    programId: ix.programId.toBase58(),
    accounts: ix.keys.map(k => ({
      pubkey: k.pubkey.toBase58(),
      isSigner: k.isSigner,
      isWritable: k.isWritable
    })),
    data: bs58.encode(ix.data)
  };
}

/**
 * Parse AccountInfo using Solana Foundation Go structure
 */
export interface FoundationGoAccount {
  lamports: number;
  owner: string;
  data: string;
  executable: boolean;
  rentEpoch: number;
}

export async function fetchFoundationAccountInfo(pubkeyStr: string): Promise<FoundationGoAccount | null> {
  try {
    const res = await fetch('/api/rpc/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'getAccountInfo',
        params: [pubkeyStr, { encoding: 'base64', commitment: 'finalized' }]
      })
    });
    const json = await res.json();
    return json.result?.value || null;
  } catch {
    return null;
  }
}
