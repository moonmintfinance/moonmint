// components/MintReviewStep.tsx
'use client';

import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TokenMetadata, MintConfig, LaunchType } from '@/types/token';

interface MintReviewStepProps {
  metadata: Partial<TokenMetadata>;
  config: MintConfig;
  launchType: LaunchType;
  imageIpfsUri?: string;
  metadataUri: string;
  totalFee: number;
  onConfirm: () => void;
  onBack: () => void;
  isLoading?: boolean;
}

export function MintReviewStep({
  metadata,
  config,
  launchType,
  imageIpfsUri,
  metadataUri,
  totalFee,
  onConfirm,
  onBack,
  isLoading = false,
}: MintReviewStepProps) {
  return (
    <div className="space-y-6 p-6 bg-dark-50 rounded-lg border border-primary-500/30">
      <div>
        <h3 className="text-2xl font-bold text-white mb-2">Step 3: Review & Mint</h3>
        <p className="text-sm text-gray-400">Review all settings before signing the transaction</p>
      </div>

      {/* Summary Cards */}
      <div className="space-y-3">
        {/* Token Info Card */}
        <div className="bg-dark-100 p-4 rounded border border-dark-300">
          <p className="text-xs font-bold text-primary-400 uppercase tracking-wide mb-3">
            Token Information
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Name:</span>
              <span className="text-white font-mono">{metadata.name || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Symbol:</span>
              <span className="text-white font-mono">{metadata.symbol || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Decimals:</span>
              <span className="text-white font-mono">{metadata.decimals || 9}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Initial Supply:</span>
              <span className="text-white font-mono">
                {metadata.initialSupply?.toLocaleString() || 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* IPFS URIs Card */}
        <div className="bg-dark-100 p-4 rounded border border-dark-300 space-y-3">
          <p className="text-xs font-bold text-primary-400 uppercase tracking-wide">
            Content on IPFS
          </p>

          {imageIpfsUri && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Image URI:</p>
              <p className="text-xs text-primary-400 font-mono break-all bg-dark-50 p-2 rounded">
                {imageIpfsUri}
              </p>
            </div>
          )}

          <div>
            <p className="text-xs text-gray-400 mb-1">Metadata JSON URI:</p>
            <p className="text-xs text-primary-400 font-mono break-all bg-dark-50 p-2 rounded">
              {metadataUri}
            </p>
          </div>
        </div>

        {/* Network & Launch Card */}
        <div className="bg-dark-100 p-4 rounded border border-dark-300">
          <p className="text-xs font-bold text-primary-400 uppercase tracking-wide mb-3">
            Launch Settings
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Launch Type:</span>
              <span className="text-white font-mono">
                {launchType === LaunchType.DIRECT ? 'Direct Mint' : 'Meteora Bonding Curve'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Network:</span>
              <span className="text-white font-mono">Solana</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Mint Authority:</span>
              <span className="text-white font-mono">
                {config.mintAuthority ? 'Retained' : 'Revoked'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Freeze Authority:</span>
              <span className="text-white font-mono">
                {config.freezeAuthority ? 'Retained' : 'Revoked'}
              </span>
            </div>
          </div>
        </div>

        {/* Fee Card */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="font-medium text-blue-300">Total Fee:</span>
            <span className="text-lg font-bold text-blue-400">
              {(totalFee / LAMPORTS_PER_SOL).toFixed(4)} SOL
            </span>
          </div>
          <p className="text-xs text-blue-300 mt-2">
            Excluding Solana network fees.
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-primary-500/30">
        <button
          onClick={onBack}
          disabled={isLoading}
          className="flex-1 py-3 rounded font-bold border border-primary-500/30 text-primary-500 hover:bg-primary-500/10 disabled:opacity-50 transition-all"
        >
          ← Back to Metadata
        </button>
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className="flex-1 py-3 rounded font-bold bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isLoading ? '⏳ Minting...' : 'Mint Token'}
        </button>
      </div>
    </div>
  );
}