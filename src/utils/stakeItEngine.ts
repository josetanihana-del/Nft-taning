/**
 * StakeIt-Web3 Protocol Staking Engine
 * Inspired by Official-Krish/StakeIt-Web3 architecture
 */

export interface StakeTier {
  id: string;
  name: string;
  minDurationDays: number;
  apyPercentage: number;
  multiplier: number;
  color: string;
  badge: string;
}

export const STAKEIT_TIERS: StakeTier[] = [
  {
    id: 'bronze',
    name: 'Bronze Flexible Vault',
    minDurationDays: 0,
    apyPercentage: 8.5,
    multiplier: 1.0,
    color: 'from-amber-700 to-amber-900',
    badge: 'Standard APY'
  },
  {
    id: 'silver',
    name: 'Silver 30-Day Lock',
    minDurationDays: 30,
    apyPercentage: 14.2,
    multiplier: 1.25,
    color: 'from-slate-400 to-slate-600',
    badge: '1.25x Multiplier'
  },
  {
    id: 'gold',
    name: 'Gold 90-Day Lock',
    minDurationDays: 90,
    apyPercentage: 22.8,
    multiplier: 1.6,
    color: 'from-yellow-500 to-amber-600',
    badge: '1.6x Multiplier'
  },
  {
    id: 'platinum',
    name: 'Platinum AI High Yield',
    minDurationDays: 180,
    apyPercentage: 35.0,
    multiplier: 2.2,
    color: 'from-cyan-500 to-purple-600',
    badge: '2.2x High APY'
  }
];

export interface StakedPrincipalRecord {
  id: string;
  userWallet: string;
  amountSol: number;
  tierId: string;
  stakedAt: number;
  lastClaimedAt: number;
  claimedYieldSol: number;
  txHash: string;
}

/**
 * Calculate accrued yield for StakeIt-Web3 principal deposit
 */
export function calculateAccruedYield(
  amountSol: number,
  tierId: string,
  stakedAt: number,
  lastClaimedAt: number
): number {
  const tier = STAKEIT_TIERS.find(t => t.id === tierId) || STAKEIT_TIERS[0];
  const now = Date.now();
  const startTime = Math.max(stakedAt, lastClaimedAt);
  const durationSeconds = Math.max(0, (now - startTime) / 1000);
  const secondsInYear = 365 * 24 * 3600;

  // Accrued SOL = amount * (APY / 100) * (duration / secondsInYear)
  const accrued = amountSol * (tier.apyPercentage / 100) * (durationSeconds / secondsInYear);
  return Math.max(0, parseFloat(accrued.toFixed(6)));
}
