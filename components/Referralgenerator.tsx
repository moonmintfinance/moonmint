'use client';

import { useState, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { generateReferralLink } from '@/utils/referral';
import { SERVICE_FEE_BASE_SOL, SERVICE_FEE_AUTHORITY_SOL } from '@/lib/constants';

export function ReferralGenerator() {
  const { publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal(); // Added wallet modal hook
  const [copied, setCopied] = useState(false);

  // Use useMemo to safely generate the link only when publicKey is available
  const referralLink = useMemo(() => {
    if (!publicKey) return '';
    return generateReferralLink(publicKey.toBase58());
  }, [publicKey]);

  const handleCopy = async () => {
    if (!publicKey || !referralLink) return;

    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const baseEarnings = SERVICE_FEE_BASE_SOL * 0.55;
  const authorityEarnings = SERVICE_FEE_AUTHORITY_SOL * 0.55;

  return (
    // Updated padding to match the original component's layout
    <div className="min-h-screen pt-32 px-6 pb-20">
      <div className="container mx-auto max-w-3xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Referral Program
          </h1>
          <p className="text-xl text-gray-400">
            We offer the highest referral rewards on in the galaxy. Earn 55% of fees from every token minted with your link!
          </p>
        </div>

        {/* Main Content */}
        <div className="space-y-8">

          {/* Your Wallet Section - Now conditional */}
          {connected && publicKey && (
            <div className="bg-dark-100/50 backdrop-blur-sm border border-dark-200 rounded-xl p-8">
              <h2 className="text-lg font-semibold text-white mb-4">Your Wallet</h2>
              <div className="bg-dark-50 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-2">Connected Address</p>
                <p className="text-sm font-mono text-primary-400 break-all">
                  {publicKey.toBase58()}
                </p>
              </div>
            </div>
          )}

          {/* Referral Link Section - Now shows connect prompt if disconnected */}
          <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-8">
            <h2 className="text-lg font-semibold text-white mb-4">Your Referral Link</h2>

            {connected && publicKey ? (
              <>
                {/* Connected State */}
                <div className="bg-dark-50 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-400">Share this link to earn commissions</p>
                    <button
                      onClick={handleCopy}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded transition-colors"
                    >
                      {copied ? '✓ Copied!' : 'Copy Link'}
                    </button>
                  </div>
                  <p className="text-xs font-mono text-purple-400 break-all bg-dark-100 p-3 rounded">
                    {referralLink}
                  </p>
                </div>

                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                  <p className="text-sm text-purple-200">
                    💡 <span className="font-medium">Pro tip:</span> Share this link on social media, Discord, or with your network to start earning!
                  </p>
                </div>
              </>
            ) : (
              <>
                {/* Disconnected State - Updated colors and button */}
                <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-8 text-center">
                  <h2 className="text-2xl font-bold text-white mb-3">
                    Connect Your Wallet
                  </h2>
                  <p className="text-gray-300 mb-6">
                    Connect your wallet to generate your unique referral link and start earning commissions.
                  </p>
                  <button
                    onClick={() => setVisible(true)}
                    className="bg-primary-500 hover:bg-primary-600 text-white font-bold py-3 px-8 rounded-lg transition-colors"
                  >
                    Connect Wallet & Reveal Link
                  </button>
                </div>
              </>
            )}
          </div>

          {/* How It Works - Now always visible */}
          <div className="bg-dark-100/50 backdrop-blur-sm border border-dark-200 rounded-xl p-8">
            <h2 className="text-lg font-semibold text-white mb-6">How It Works</h2>

            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-primary-500/20 rounded-full flex items-center justify-center">
                  <span className="text-primary-400 font-bold">1</span>
                </div>
                <div>
                  <h3 className="font-medium text-white mb-1">Share Your Link</h3>
                  <p className="text-sm text-gray-400">
                    Give your referral link to friends, colleagues, or post it on social media
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-primary-500/20 rounded-full flex items-center justify-center">
                  <span className="text-primary-400 font-bold">2</span>
                </div>
                <div>
                  <h3 className="font-medium text-white mb-1">They Create a Token</h3>
                  <p className="text-sm text-gray-400">
                    Anyone who uses your link and creates a token will automatically pay you a commission
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-primary-500/20 rounded-full flex items-center justify-center">
                  <span className="text-primary-400 font-bold">3</span>
                </div>
                <div>
                  <h3 className="font-medium text-white mb-1">Get Paid Instantly</h3>
                  <p className="text-sm text-gray-400">
                    55% of the service fee goes directly to your wallet when the token is created
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-primary-500/20 rounded-full flex items-center justify-center">
                  <span className="text-primary-400 font-bold">4</span>
                </div>
                <div>
                  <h3 className="font-medium text-white mb-1">Verify on Solscan</h3>
                  <p className="text-sm text-gray-400">
                    All transactions are on-chain and auditable on Solscan
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}