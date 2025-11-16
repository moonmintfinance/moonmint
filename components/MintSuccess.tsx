'use client';

import { useState } from 'react';
import { LaunchType } from './TokenForm';

interface MintSuccessProps {
  mintAddress: string;
  signature: string;
  launchType: LaunchType;
  onReset: () => void;
}

export function MintSuccess({
  mintAddress,
  signature,
  launchType,
  onReset
}: MintSuccessProps) {
  const [copied, setCopied] = useState<'mint' | 'signature' | null>(null);

  const handleCopy = async (text: string, type: 'mint' | 'signature') => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const cluster = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
  const explorerUrl = `https://solscan.io/token/${mintAddress}?cluster=${cluster}`;
  const signatureUrl = `https://solscan.io/tx/${signature}?cluster=${cluster}`;

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
          Token Created Successfully
        </h3>
        <p className="text-gray-400">
          Your token has been minted on the Solana blockchain. It may take a few minutes to display on SOLSCAN.
        </p>
      </div>

      <div className="space-y-4 mb-8">
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

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 bg-primary-500 hover:bg-primary-600 text-white font-medium py-3 px-6 rounded-lg transition-colors text-center"
        >
          View on Explorer
        </a>
        <a
          href={signatureUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 bg-dark-200 hover:bg-dark-300 text-white font-medium py-3 px-6 rounded-lg transition-colors text-center"
        >
          View Transaction
        </a>
      </div>

      <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-4 mb-6">
        <div className="text-sm text-gray-300">
          <div className="font-semibold mb-2">Next Steps</div>
          <ul className="list-disc list-inside space-y-1 text-xs text-gray-400">
            <li>Your token is now live on Solana</li>
            <li>You can view it in your wallet</li>
            <li>Share the mint address with others</li>
          </ul>
        </div>
      </div>

      <button
        onClick={onReset}
        className="w-full bg-dark-200 hover:bg-dark-300 text-white font-medium py-3 rounded-lg transition-colors"
      >
        Create Another Token
      </button>
    </div>
  );
}