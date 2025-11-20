'use client';

import { TokenMetadata, MintConfig } from '@/types/token';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getReferralWallet } from '@/utils/referral';
import { LaunchType } from './TokenForm';

interface TransactionConfirmationProps {
  metadata: TokenMetadata;
  config: MintConfig;
  totalFee: number;
  launchType: LaunchType;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TransactionConfirmation({
  metadata,
  config,
  totalFee,
  launchType,
  onConfirm,
  onCancel,
}: TransactionConfirmationProps) {
  const totalFeeSol = (totalFee / LAMPORTS_PER_SOL).toFixed(4);
  const referralWallet = getReferralWallet();
  const referralEarnings = referralWallet ? Math.floor(totalFee * 0.55) : 0;
  const referralEarningsSol = (referralEarnings / LAMPORTS_PER_SOL).toFixed(4);

  const isMeteora = launchType === LaunchType.METEORA;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-100 border-2 border-primary-500/50 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-primary-500/10 border-b border-primary-500/30 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary-500/20 rounded-full flex items-center justify-center">
              <svg
                className="w-6 h-6 text-primary-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Confirm Transaction</h3>
              <p className="text-sm text-gray-400">
                {isMeteora ? 'Review bonding curve launch details' : 'Review before signing'}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Security Warning */}
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex gap-3">
              <div className="text-yellow-500 text-xl">⚠️</div>
              <div>
                <div className="font-semibold text-yellow-400 text-sm">
                  Security Check
                </div>
                <div className="text-xs text-yellow-300 mt-1">
                  {isMeteora
                    ? 'You are about to launch a token on Moon Mints\'s bonding curve. This creates a dynamic pricing mechanism and allocates your token to the curve.'
                    : 'You are about to sign a transaction that will create a new token on Solana. Review all details carefully before confirming.'}
                </div>
              </div>
            </div>
          </div>

          {/* Token Details */}
          <div className="space-y-4">
            <div className="text-sm font-semibold text-primary-400">
              Token Details
            </div>

            <div className="bg-dark-50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400 text-sm">Name:</span>
                <span className="text-white font-medium">{metadata.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 text-sm">Symbol:</span>
                <span className="text-white font-medium">{metadata.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 text-sm">Decimals:</span>
                <span className="text-white font-medium">{metadata.decimals}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 text-sm">Initial Supply:</span>
                <span className="text-white font-medium">
                  {metadata.initialSupply.toLocaleString()}
                </span>
              </div>
              {metadata.imageUrl && (
                <div className="flex justify-between items-start">
                  <span className="text-gray-400 text-sm">Image URL:</span>
                  <span className="text-white font-medium text-xs break-all max-w-[200px] text-right">
                    {metadata.imageUrl}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Authorities - Only for Direct launches */}
          {!isMeteora && (
            <div className="space-y-4">
              <div className="text-sm font-semibold text-primary-400">
                Token Authorities
              </div>

              <div className="bg-dark-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Mint Authority:</span>
                  <span
                    className={`font-medium ${
                      config.mintAuthority ? 'text-green-400' : 'text-yellow-400'
                    }`}
                  >
                    {config.mintAuthority ? 'Revoked ✓' : 'Retained'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Freeze Authority:</span>
                  <span
                    className={`font-medium ${
                      config.freezeAuthority ? 'text-green-400' : 'text-yellow-400'
                    }`}
                  >
                    {config.freezeAuthority ? 'Revoked ✓' : 'Retained'}
                  </span>
                </div>
              </div>

              {(!config.mintAuthority || !config.freezeAuthority) && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                  <p className="text-xs text-yellow-300">
                    ⚠️ You are retaining some authorities. This means you can mint more
                    tokens or freeze accounts. Most projects revoke these for
                    transparency.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Meteora-specific info */}
          {isMeteora && (
            <div className="space-y-4">
              <div className="text-sm font-semibold text-primary-400">
                Bonding Curve Details
              </div>

              <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-4 space-y-3">
                <div className="text-xs text-gray-300">
                  <p className="mb-2">
                    Your token will be deployed with a dynamic bonding curve that automatically manages pricing based on supply and demand.
                  </p>
                  <ul className="space-y-1 list-disc list-inside text-gray-400">
                    <li>Price increases as tokens are purchased from the curve</li>
                    <li>Automatic liquidity provisioning</li>
                    <li>No manual liquidity management needed</li>
                    <li>Automatic migration to DEX when threshold reached</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Cost Breakdown */}
          <div className="space-y-4">
            <div className="text-sm font-semibold text-primary-400">
              Transaction Cost
            </div>

            <div className="bg-dark-50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">
                  {isMeteora ? 'Total Launch Fee:' : 'Total Service Fee:'}
                </span>
                <span className="text-2xl font-bold text-primary-300">
                  {totalFeeSol} SOL
                </span>
              </div>
              <div className="text-xs text-gray-500">
                Plus network transaction fees (~0.001 SOL)
              </div>

              {referralWallet && (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-purple-300 text-sm font-medium">Referrer Earns:</span>
                    <span className="text-purple-300 font-bold">{referralEarningsSol} SOL</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-dark-200 p-6 flex gap-3 bg-primary-500/5">
          <button
            onClick={onCancel}
            className="flex-1 bg-dark-200 hover:bg-dark-300 text-white font-medium py-3 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-primary-500 hover:bg-primary-600 text-white font-bold py-3 rounded-lg transition-colors"
          >
            {isMeteora ? 'Launch on Moon Mint bonding curve' : 'Sign & Create'}
          </button>
        </div>
      </div>
    </div>
  );
}