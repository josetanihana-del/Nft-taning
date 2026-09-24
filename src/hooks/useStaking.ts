import { useState, useEffect, useMemo } from 'react';
import * as anchor from "@coral-xyz/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import idl from "../nft_staking.json";

// Default Anchor Staking Program ID (Can be configured with deployed program)
export const STAKING_PROGRAM_ID = new anchor.web3.PublicKey("Stk1111111111111111111111111111111111111111");

export interface WalletTokenAccountInfo {
  pubkey: anchor.web3.PublicKey;
  mint: string;
  amount: number;
  decimals: number;
}

export function useStaking() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [tokenAccounts, setTokenAccounts] = useState<WalletTokenAccountInfo[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch real on-chain SPL Token Accounts for connected wallet
  useEffect(() => {
    if (!wallet.publicKey) {
      setTokenAccounts([]);
      return;
    }

    const fetchTokenAccounts = async () => {
      setLoading(true);
      try {
        const response = await connection.getParsedTokenAccountsByOwner(
          wallet.publicKey!,
          { programId: TOKEN_PROGRAM_ID }
        );

        const accounts: WalletTokenAccountInfo[] = response.value
          .map((item) => {
            const parsedInfo = item.account.data.parsed?.info;
            return {
              pubkey: item.pubkey,
              mint: parsedInfo?.mint || '',
              amount: parsedInfo?.tokenAmount?.uiAmount || 0,
              decimals: parsedInfo?.tokenAmount?.decimals || 0,
            };
          })
          .filter(acc => acc.amount > 0);

        setTokenAccounts(accounts);
      } catch (err) {
        console.warn("Notice querying token accounts:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTokenAccounts();
  }, [connection, wallet.publicKey]);

  const program = useMemo(() => {
    if (!wallet.publicKey) return null;
    
    try {
      const provider = new anchor.AnchorProvider(
        connection, 
        wallet as unknown as anchor.Wallet, 
        anchor.AnchorProvider.defaultOptions()
      );
      
      const idlWithAddress = {
        ...idl,
        address: STAKING_PROGRAM_ID.toBase58(),
      };

      return new anchor.Program(
        idlWithAddress as any, 
        provider
      );
    } catch (e) {
      console.warn("Anchor program initialization notice:", e);
      return null;
    }
  }, [connection, wallet]);

  return { 
    program, 
    tokenAccounts, 
    loading,
    programId: STAKING_PROGRAM_ID 
  };
}
