'use client';

import { NATIVE_MINT } from '@solana/spl-token';
import { JupiterPlugin } from './JupiterPlugin';
import { BRANDING_CONFIG } from '@/lib/constants';
import type { FormProps } from '@/types/jupiter';

interface PoolContentProps {
  mint: string;
}

export function PoolContent({ mint }: PoolContentProps) {
  const solscanUrl = `https://solscan.io/token/${mint}?cluster=${
    process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet'
  }`;

  // BirdEye embed URL with parameters from your snippet
  const birdEyeEmbedUrl = `https://birdeye.so/tv-widget/${mint}?chain=solana&viewMode=pair&chartInterval=1D&chartType=CANDLE&chartTimezone=Asia%2FSingapore&chartLeftToolbar=show&theme=dark`;

  // Jupiter form props to default to SOL -> Token swap
  const jupiterFormProps: Partial<FormProps> = {
    swapMode: 'ExactIn',
    initialInputMint: NATIVE_MINT.toBase58(), // SOL
    initialOutputMint: mint, // The created token
  };

  return (
    <div className="flex-grow container mx-auto px-6 pt-24 pb-20 max-w-7xl">
      {/* Token Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold text-white mb-2">Token Trading (chart populates after the first trade)</h1>
            <p className="text-gray-400 text-sm font-mono break-all">{mint}</p>
          </div>
          <a
            href={solscanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm transition-colors whitespace-nowrap"
          >
            View on Solscan ↗
          </a>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart - Takes 2 columns on desktop */}
        <div className="lg:col-span-2">
          <style>{`
            #chart-embed {
              position: relative;
              width: 100%;
              padding-bottom: 125%;
            }
            @media (min-width: 1400px) {
              #chart-embed {
                padding-bottom: 75%;
              }
            }
            #chart-embed iframe {
              position: absolute;
              width: 100%;
              height: 100%;
              top: 0;
              left: 0;
              border: 0;
              border-radius: 0.75rem;
            }
          `}</style>
          <div
            id="chart-embed"
            className="bg-dark-100/50 backdrop-blur-sm border border-dark-200 rounded-xl overflow-hidden"
          >
            <iframe
              src={birdEyeEmbedUrl}
              title="BirdEye Token Chart"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>

        {/* Jupiter Widget - Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-dark-100/50 backdrop-blur-sm border border-dark-200 rounded-xl p-4 sticky top-24">
            <h2 className="text-lg font-semibold text-white mb-4">Quick Swap</h2>
            <p className="text-xs text-gray-400 mb-4">
              Swap SOL for {mint.slice(0, 4)}... instantly with Jupiter
            </p>

            {/* Jupiter Widget Container */}
            <div className="relative z-30">
              <JupiterPlugin
                displayMode="integrated"
                formProps={jupiterFormProps}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}