'use client';

import { useState } from 'react';
import { LaunchType } from './TokenForm';
import { BRANDING_CONFIG } from '@/lib/constants';

interface MintSuccessProps {
  mintAddress: string;
  signature: string;
  launchType: LaunchType;
  poolAddress?: string;
  onReset: () => void;
}

export function MintSuccess({
  mintAddress,
  signature,
  launchType,
  poolAddress,
  onReset
}: MintSuccessProps) {
  const [copied, setCopied] = useState<'mint' | 'signature' | 'pool' | null>(null);

  const handleCopy = async (text: string, type: 'mint' | 'signature' | 'pool') => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const cluster = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
  const explorerUrl = `https://solscan.io/token/${mintAddress}?cluster=${cluster}`;
  const signatureUrl = `https://solscan.io/tx/${signature}?cluster=${cluster}`;
  const poolExplorerUrl = poolAddress
    ? `https://solscan.io/account/${poolAddress}?cluster=${cluster}`
    : null;

  return (
    <div className="bg-dark-100/50 backdrop-blur-sm border-2 border-dark-200 rounded-xl p-8">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-green-500/20 border border-green-500/50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-white mb-2">
          {launchType === LaunchType.METEORA
            ? `Token Launched on a Meteora bonding curve!`
            : 'Token Created Successfully'}
        </h3>
        <p className="text-gray-400">
          {launchType === LaunchType.METEORA
            ? `Your token is now live on a Meteora bonding curve. It may take a few minutes to display on SOLSCAN.`
            : 'Your token has been minted on the Solana blockchain. It may take a few minutes to display on SOLSCAN.'}
        </p>
      </div>

      <div className="space-y-4 mb-8">
        {/* Mint Address */}
        <div className="bg-dark-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-400">
              Mint Address
            </label>
            <button
              onClick={() => handleCopy(mintAddress, 'mint')}
              className="text-xs bg-dark-200 hover:bg-dark-300 px-3 py-1 rounded transition-colors text-white"
            >
              {copied === 'mint' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="text-sm font-mono break-all text-primary-400">
            {mintAddress}
          </div>
        </div>

        {/* Pool Address (Meteora only) */}
        {launchType === LaunchType.METEORA && poolAddress && (
          <div className="bg-dark-50 rounded-lg p-4 border-2 border-primary-500/30">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-primary-400 flex items-center gap-2">
                Meteora Pool Address
              </label>
              <button
                onClick={() => handleCopy(poolAddress, 'pool')}
                className="text-xs bg-primary-500 hover:bg-primary-600 px-3 py-1 rounded transition-colors text-white"
              >
                {copied === 'pool' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="text-sm font-mono break-all text-primary-400">
              {poolAddress}
            </div>
          </div>
        )}

        {/* Transaction Signature */}
        <div className="bg-dark-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-400">
              Transaction Signature
            </label>
            <button
              onClick={() => handleCopy(signature, 'signature')}
              className="text-xs bg-dark-200 hover:bg-dark-300 px-3 py-1 rounded transition-colors text-white"
            >
              {copied === 'signature' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="text-sm font-mono break-all text-primary-400">
            {signature}
          </div>
        </div>
      </div>

      {/* Action Buttons - UPDATED */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* NEW: Trade Now Button */}
        <a
          href={`/pools/${mintAddress}`}
          className="flex-1 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 hover:scale-105 shadow-lg shadow-primary-500/20 text-center flex items-center justify-center gap-2"
        >
          <span>Trade Now & View Chart</span>
        </a>

        {/* Pool Explorer */}
        {launchType === LaunchType.METEORA && poolExplorerUrl && (
          <a
            href={poolExplorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-medium py-3 px-6 rounded-lg transition-colors text-center"
          >
            View Pool on Explorer
          </a>
        )}

        {/* Transaction Explorer */}
        <a
          href={signatureUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 bg-dark-200 hover:bg-dark-300 text-white font-medium py-3 px-6 rounded-lg transition-colors text-center"
        >
          View Transaction
        </a>
      </div>

      {/* Meteora-specific info */}
      {launchType === LaunchType.METEORA && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="font-semibold text-purple-300 text-sm mb-1">
                About Meteora Bonding Curves
              </div>
              <p className="text-xs text-gray-300">
                Your token uses a dynamic bonding curve that automatically adjusts pricing based on supply and demand.
                As more people buy, the price increases. Once the curve reaches its migration threshold,
                your token will automatically graduate to a full DAMM (Dynamic Automated Market Maker) pool on Meteora.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Reset Button */}
      <button
        onClick={onReset}
        className="w-full bg-dark-200 hover:bg-dark-300 text-white font-medium py-3 rounded-lg transition-colors"
      >
        Create Another Token
      </button>
    </div>
  );
}