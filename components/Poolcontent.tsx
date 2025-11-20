'use client';

interface PoolContentProps {
  mint: string;
}

export function PoolContent({ mint }: PoolContentProps) {
  // Determine the chain parameter based on environment
  const getChainParam = (): string => {
    const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK;
    switch (network) {
      case 'mainnet-beta':
        return 'solana';
      case 'devnet':
        return 'solana_devnet';
      case 'testnet':
        return 'solana_testnet';
      default:
        return 'solana_devnet';
    }
  };

  const solscanUrl = `https://solscan.io/token/${mint}?cluster=${
    process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet'
  }`;

  const birdeyeUrl = `https://birdeye.so/token/${mint}?chain=${getChainParam()}`;

  return (
    <div className="flex-grow container mx-auto px-6 pt-24 pb-20 max-w-7xl">
      {/* Token Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold text-white mb-2">Token Trading</h1>
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

      {/* BirdEye Chart - Full Width */}
      <div className="bg-dark-100/50 backdrop-blur-sm border border-dark-200 rounded-xl overflow-hidden h-[600px] sm:h-[800px]">
        <iframe
          src={birdeyeUrl}
          className="w-full h-full border-0"
          title="BirdEye Token Chart"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}