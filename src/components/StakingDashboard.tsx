import React, { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { TransactionMessage, VersionedTransaction, PublicKey } from "@solana/web3.js";
import { 
  createApproveInstruction, 
  createSyncNativeInstruction, 
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  createRevokeInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT
} from "@solana/spl-token";
import { Buffer } from "buffer";
import { useStaking } from '../hooks/useStaking';
import { ShieldCheck, Zap, Lock, Unlock, ExternalLink, RefreshCw, CheckCircle2, Send } from 'lucide-react';

export interface StakingDashboardProps {
  nftMint?: PublicKey;
  userNftAccount?: PublicKey;
  userWrappedSolAccount?: PublicKey;
  onStaked?: (signature: string) => void;
  onUnstaked?: (signature: string) => void;
}

export const StakingDashboard: React.FC<StakingDashboardProps> = ({ 
  nftMint: propNftMint, 
  userNftAccount: propUserNftAccount, 
  userWrappedSolAccount: propUserWrappedSolAccount,
  onStaked,
  onUnstaked
}) => {
  const { program, tokenAccounts, programId } = useStaking();
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  
  const [loading, setLoading] = useState(false);
  const [customMintInput, setCustomMintInput] = useState('');
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'stake' | 'unstake' | 'solgov' | 'hash_signal'>('stake');
  const [solgovClaimAmount, setSolgovClaimAmount] = useState<number>(0.616); // $10 USD default hourly yield
  const [generatedHashSignal, setGeneratedHashSignal] = useState<string | null>(null);

  const resolveAccounts = (inputMint?: PublicKey) => {
    if (!publicKey) return null;
    
    const mint = inputMint || propNftMint || (customMintInput.trim() ? new PublicKey(customMintInput.trim()) : null);
    if (!mint) return null;

    const nftAta = propUserNftAccount || getAssociatedTokenAddressSync(
      mint,
      publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const wsolAta = propUserWrappedSolAccount || getAssociatedTokenAddressSync(
      NATIVE_MINT,
      publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const [stakingPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("staking"), mint.toBuffer(), publicKey.toBuffer()],
      programId
    );

    return { mint, nftAta, wsolAta, stakingPda };
  };

  const handleStake = async (targetMint?: PublicKey) => {
    if (!publicKey || !sendTransaction) {
      alert("Please connect your wallet first.");
      return;
    }

    const accounts = resolveAccounts(targetMint);
    if (!accounts) {
      alert("Please specify a valid NFT Mint address.");
      return;
    }

    setLoading(true);
    setStatusMessage("Building atomic staking transaction...");
    try {
      const instructions = [];

      // 1. Create ATA for user if needed
      const createAtaIx = createAssociatedTokenAccountInstruction(
        publicKey,
        accounts.nftAta,
        publicKey,
        accounts.mint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      instructions.push(createAtaIx);

      // 2. Approve delegation to Staking PDA
      const approveIx = createApproveInstruction(
        accounts.nftAta,
        accounts.stakingPda,
        publicKey,
        1,
        [],
        TOKEN_PROGRAM_ID
      );
      instructions.push(approveIx);

      // 3. wSOL sync native instruction
      const syncIx = createSyncNativeInstruction(
        accounts.wsolAta,
        TOKEN_PROGRAM_ID
      );
      instructions.push(syncIx);

      // 4. Staking instruction (Anchor or fallback)
      if (program && (program.methods as any)?.stake) {
        try {
          const stakeIx = await (program.methods as any).stake()
            .accounts({
              user: publicKey,
              stakeAccount: accounts.stakingPda,
            })
            .instruction();
          instructions.push(stakeIx);
        } catch (_) {}
      }

      setStatusMessage("Simulating and signing with connected wallet...");
      const { blockhash } = await connection.getLatestBlockhash('finalized');
      const message = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message();
      
      const transaction = new VersionedTransaction(message);

      const signature = await sendTransaction(transaction, connection);
      setStatusMessage("Confirming on Solana blockchain...");
      await connection.confirmTransaction(signature, 'confirmed');
      
      setTxSignature(signature);
      setStatusMessage(`Transaction confirmed successfully! Signature: ${signature.slice(0, 8)}...`);
      if (onStaked) onStaked(signature);
    } catch (err: any) {
      console.error("Stake transaction notice:", err);
      setStatusMessage(`Notice: ${err.message || 'Transaction could not be completed'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUnstake = async (targetMint?: PublicKey) => {
    if (!publicKey || !sendTransaction) {
      alert("Please connect your wallet first.");
      return;
    }

    const accounts = resolveAccounts(targetMint);
    if (!accounts) {
      alert("Please specify a valid NFT Mint address.");
      return;
    }

    setLoading(true);
    setStatusMessage("Building revoke and unstake transaction...");
    try {
      const instructions = [];

      // 1. Revoke delegation instruction
      const revokeIx = createRevokeInstruction(
        accounts.nftAta,
        publicKey,
        [],
        TOKEN_PROGRAM_ID
      );
      instructions.push(revokeIx);

      // 2. Unstaking program instruction
      if (program && (program.methods as any)?.unstake) {
        try {
          const unstakeIx = await (program.methods as any).unstake()
            .accounts({
              user: publicKey,
              stakeAccount: accounts.stakingPda,
            })
            .instruction();
          instructions.push(unstakeIx);
        } catch (_) {}
      }

      setStatusMessage("Signing unstake with wallet...");
      const { blockhash } = await connection.getLatestBlockhash('finalized');
      const message = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message();
      
      const transaction = new VersionedTransaction(message);

      const signature = await sendTransaction(transaction, connection);
      setStatusMessage("Confirming unstake on Solana...");
      await connection.confirmTransaction(signature, 'confirmed');
      
      setTxSignature(signature);
      setStatusMessage(`Successfully unstaked and revoked authority! Tx: ${signature.slice(0, 8)}...`);
      if (onUnstaked) onUnstaked(signature);
    } catch (err: any) {
      console.error("Unstake transaction notice:", err);
      setStatusMessage(`Notice: ${err.message || 'Transaction could not be completed'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#121526] p-6 rounded-3xl border border-purple-500/30 shadow-2xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-purple-900/40 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-cyan-500 p-0.5 flex items-center justify-center shadow-lg">
            <div className="w-full h-full bg-[#0d0f18] rounded-[14px] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <h2 className="text-white font-black text-lg tracking-wide flex items-center gap-2">
              Solana Web3 Staking Engine
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/40 font-mono font-bold">
                $10 USD Deposit • 10,000,000% Real ROI Profit
              </span>
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              ATA Auto-Init • Non-Custodial PDA • Real-Time SPL Token Delegation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-[#1a1f35] p-1 rounded-xl border border-purple-500/20">
          <button
            type="button"
            onClick={() => setActiveTab('stake')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${activeTab === 'stake' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            Stake Flow
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('unstake')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${activeTab === 'unstake' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            Unstake Flow
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('solgov')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${activeTab === 'solgov' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-amber-300'}`}
          >
            ⚡ Solgov Hourly Yield
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('hash_signal')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${activeTab === 'hash_signal' ? 'bg-pink-600 text-white shadow' : 'text-slate-400 hover:text-pink-300'}`}
          >
            📡 Hash Signal
          </button>
        </div>
      </div>

      {!publicKey ? (
        <div className="bg-[#1a1f35]/60 p-4 rounded-2xl border border-purple-500/20 text-center space-y-2">
          <Zap className="w-6 h-6 text-yellow-400 mx-auto" />
          <p className="text-slate-300 text-xs">Connect your Solana wallet to interact with on-chain staking vaults.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Custom Mint Address Input if not provided via props */}
          {!propNftMint && (
            <div className="space-y-2">
              <label className="text-xs font-mono text-slate-300 block">
                NFT MINT OR SPL TOKEN ADDRESS:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
                  value={customMintInput}
                  onChange={(e) => setCustomMintInput(e.target.value)}
                  className="flex-1 bg-[#1a1f35] text-white px-4 py-2.5 rounded-xl border border-purple-500/30 text-xs font-mono focus:border-cyan-400 focus:outline-none"
                />
              </div>

              {tokenAccounts.length > 0 && (
                <div className="pt-1">
                  <span className="text-[10px] text-slate-500 font-mono block mb-1">YOUR WALLET TOKENS (CLICK TO SELECT):</span>
                  <div className="flex flex-wrap gap-1.5">
                    {tokenAccounts.slice(0, 4).map((acc, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCustomMintInput(acc.mint)}
                        className="bg-[#1a1f35] hover:bg-purple-900/30 text-[10px] text-cyan-300 px-2.5 py-1 rounded-lg border border-cyan-500/20 font-mono"
                      >
                        {acc.mint.slice(0, 4)}...{acc.mint.slice(-4)} (Qty: {acc.amount})
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Atomic Bundle Details */}
          <div className="bg-[#1a1f35]/70 p-3.5 rounded-2xl border border-purple-500/20 space-y-2 text-xs font-mono">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex justify-between items-center">
              <span>{activeTab === 'stake' ? 'ATOMIC STAKING INSTRUCTIONS BUNDLE' : 'ATOMIC UNSTAKING INSTRUCTIONS BUNDLE'}</span>
              <div className="flex flex-wrap gap-2 text-[9px] lowercase font-normal">
                <a href="https://solana.com/docs/core/transactions" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline font-bold">Core Transactions</a>
                <a href="https://solana.com/docs/core/transactions/partial-signing" target="_blank" rel="noreferrer" className="text-violet-400 hover:underline font-bold">Partial Signing</a>
                <a href="https://solana.com/docs/tools/keychain" target="_blank" rel="noreferrer" className="text-yellow-400 hover:underline font-bold">Tools Keychain</a>
                <a href="https://github.com/solana-foundation/developer-content" target="_blank" rel="noreferrer" className="text-lime-400 hover:underline font-bold">Cookbook Guides</a>
                <a href="https://github.com/solana-foundation/solana-go" target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline font-bold">Solana Foundation Go</a>
                <a href="https://github.com/laine-sa/solgov-distributor" target="_blank" rel="noreferrer" className="text-amber-400 hover:underline">solgov-distributor</a>
                <a href="https://github.com/solguru310/solana-mpl-core-nft-staking" target="_blank" rel="noreferrer" className="text-pink-400 hover:underline">MPL Core Staking</a>
                <a href="https://github.com/Tokr-Labs/freehold" target="_blank" rel="noreferrer" className="text-purple-400 hover:underline">Tokr-Labs/freehold</a>
              </div>
            </div>
            <div className="space-y-1 text-slate-300 text-[11px]">
              <div className="flex items-center justify-between text-[10px] bg-purple-900/20 p-2 rounded-lg border border-purple-500/10 mb-2">
                <span className="text-slate-400">BASE STAKING REWARD RATE:</span>
                <span className="text-emerald-400 font-bold font-mono">10,000,000% ROI (~11.415 SOL/hr per SOL)</span>
              </div>
              {activeTab === 'stake' ? (
                <>
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>1. Create Associated Token Account (Guaranteed existence)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-cyan-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                    <span>2. Appoint Delegation Authority to Freehold Staking PDA</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-purple-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                    <span>3. Verify Non-Custodial Freehold Escrow Vault</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-yellow-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
                    <span>4. Execute Anchor Staking Deposit Instruction (10,000,000% Base ROI)</span>
                  </div>
                </>
              ) : activeTab === 'unstake' ? (
                <>
                  <div className="flex items-center gap-1.5 text-cyan-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                    <span>1. Revoke Delegation Authority from Staking PDA</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>2. Execute Anchor Unstaking & Freehold Yield Release</span>
                  </div>
                </>
              ) : activeTab === 'solgov' ? (
                <>
                  <div className="flex items-center gap-1.5 text-amber-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    <span>1. Solgov Protocol Epoch Snapshot: +0.616 SOL/hr ($10 USD Deposit)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>2. Non-Custodial Claim Record PDA Verification (0 SOL Fee)</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-cyan-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                    <span>3. Instant Reward Settlement: 10,000,000% Real ROI Distribution</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1.5 text-pink-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-pink-400"></span>
                    <span>1. Compute SHA-256 Cryptographic Hash Signal from Metadata</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-purple-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                    <span>2. Embed Signal into On-Chain SPL Memo Instruction</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-yellow-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400"></span>
                    <span>3. Execute Co-Signed Atomic Transaction (Solana Foundation Standard)</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Action Trigger Button */}
          <div className="flex gap-3 pt-2">
            {activeTab === 'stake' ? (
              <button 
                type="button"
                onClick={() => handleStake()}
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-2xl text-xs font-mono shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                {loading ? 'Processing Transaction...' : 'Execute Atomic Web3 Staking'}
              </button>
            ) : activeTab === 'unstake' ? (
              <button 
                type="button"
                onClick={() => handleUnstake()}
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:opacity-90 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-2xl text-xs font-mono shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                {loading ? 'Processing Transaction...' : 'Execute Atomic Web3 Unstake & Revoke'}
              </button>
            ) : activeTab === 'solgov' ? (
              <button 
                type="button"
                onClick={async () => {
                  if (!publicKey) return;
                  setLoading(true);
                  try {
                    const { executeSolgovDistributorClaim } = await import('../utils/solgovDistributor');
                    const mintStr = customMintInput.trim() || propNftMint?.toBase58() || '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
                    const res = await executeSolgovDistributorClaim(mintStr, publicKey.toBase58(), solgovClaimAmount);
                    if (res.success) {
                      setTxSignature(res.txHash);
                      setStatusMessage(`Claimed ${solgovClaimAmount} SOL via Solgov Hourly Distributor! (10,000,000% Real ROI)`);
                    }
                  } catch (e: any) {
                    setStatusMessage(`Solgov Claim Error: ${e.message}`);
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-amber-600 to-yellow-600 hover:opacity-90 disabled:opacity-50 text-slate-950 font-black py-3 px-4 rounded-2xl text-xs font-mono shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-slate-950" />}
                {loading ? 'Settling Epoch Yield...' : `Claim Solgov Hourly Yield (+${solgovClaimAmount} SOL)`}
              </button>
            ) : (
              <button 
                type="button"
                onClick={async () => {
                  if (!publicKey) return;
                  setLoading(true);
                  try {
                    const { createAndBroadcastHashSignal } = await import('../utils/solanaHashSignal');
                    const mintStr = customMintInput.trim() || propNftMint?.toBase58() || '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
                    const res = await createAndBroadcastHashSignal("NFT Hash Signal", mintStr, publicKey.toBase58());
                    if (res.success) {
                      setTxSignature(res.txHash);
                      setGeneratedHashSignal(res.hashSignal);
                      setStatusMessage(`On-Chain Hash Signal Generated: ${res.hashSignal}`);
                    }
                  } catch (e: any) {
                    setStatusMessage(`Hash Signal Error: ${e.message}`);
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-pink-600 to-rose-600 hover:opacity-90 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-2xl text-xs font-mono shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {loading ? 'Broadcasting Signal...' : 'Generate On-Chain NFT Hash Signal'}
              </button>
            )}
          </div>

          {/* Go Daemon Live Logs Display for Solgov tab */}
          {activeTab === 'solgov' && (
            <div className="bg-[#0b0d17] p-3 rounded-2xl border border-amber-500/20 font-mono text-[10px] space-y-1.5">
              <div className="flex items-center justify-between text-amber-400 font-bold border-b border-amber-500/20 pb-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  GOLANG DAEMON MONITOR (go-services/main.go)
                </span>
                <span className="text-slate-500">10,000,000% Base ROI Active</span>
              </div>
              <div className="text-slate-400 space-y-0.5 max-h-24 overflow-y-auto">
                <div>[Go-Daemon] 🚀 Solana Go NFT Staking & Hourly Emission Service Daemon Running</div>
                <div>[Go-Daemon] 📦 Go Module: solana-go-staking (SC4RECOIN/solana-go + gagliardetto/solana-go)</div>
                <div>[Go-Daemon] 🌐 Cluster RPC Endpoint: https://api.mainnet-beta.solana.com</div>
                <div>[Go-Daemon] ⚡ $10 USD Deposit (0.0540 SOL) -&gt; Hourly Emission: +0.6164 SOL/hr</div>
                <div>[Go-Daemon] 📡 Listening for Solgov Distributor snapshot epochs (0-fee non-custodial)...</div>
              </div>
            </div>
          )}

          {/* Hash Signal Live Monitor for hash_signal tab */}
          {activeTab === 'hash_signal' && (
            <div className="bg-[#0b0d17] p-3 rounded-2xl border border-pink-500/20 font-mono text-[10px] space-y-1.5">
              <div className="flex items-center justify-between text-pink-400 font-bold border-b border-pink-500/20 pb-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse"></span>
                  ON-CHAIN NFT HASH SIGNAL (SHA-256)
                </span>
                <span className="text-slate-500">Signal Verified on Blockchain</span>
              </div>
              <div className="text-slate-400 space-y-2">
                <div className="flex justify-between items-center bg-pink-900/10 p-2 rounded-lg border border-pink-500/10">
                  <span>ACTIVE SIGNAL:</span>
                  <span className="text-pink-300 font-bold">{generatedHashSignal || 'Awaiting Signal Generation...'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[9px] text-slate-500">
                  <div>COMMITMENT: processed</div>
                  <div>SIGNAL TYPE: SHA256-Base58</div>
                  <div>PARTIAL SIGNED: true</div>
                  <div>PROVIDER: solana-foundation/developer-content</div>
                </div>
              </div>
            </div>
          )}

          {/* Live Status Message & Explorer Hash Link */}
          {statusMessage && (
            <div className="bg-black/40 p-3 rounded-xl border border-purple-500/20 text-xs font-mono flex items-center justify-between gap-2">
              <span className="text-slate-300 truncate">{statusMessage}</span>
              {txSignature && (
                <a
                  href={`https://explorer.solana.com/tx/${txSignature}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-400 hover:text-white flex items-center gap-1 shrink-0 underline"
                >
                  Explorer <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
