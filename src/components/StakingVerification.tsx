import React from 'react';
import { useStaking } from '../hooks/useStaking';

export const StakingVerification: React.FC = () => {
  const { program, loading } = useStaking();

  return (
    <div className="mt-4 p-4 bg-slate-900 rounded-xl border border-slate-700">
      <h3 className="text-white font-bold mb-2">Program Status</h3>
      <p className={`text-sm ${program ? 'text-green-400' : 'text-red-400'}`}>
        {program ? 'Connected to On-Chain Program' : 'Disconnected / Loading...'}
      </p>
      {loading && <p className="text-cyan-400 text-sm mt-1">Fetching NFT assets...</p>}
    </div>
  );
};
