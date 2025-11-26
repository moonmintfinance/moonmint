/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      os: false,
      path: false,
    };
    return config;
  },
  // Allow Next.js Image component to load from Pinata gateway
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'gateway.pinata.cloud',
        pathname: '/ipfs/**',
      },
      {
        protocol: 'https',
        hostname: 'indigo-historic-lark-315.mypinata.cloud',
        pathname: '/ipfs/**',
      },
    ],
  },
  headers: async () => {
    // Build CSP based on environment
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Development CSP - allows HMR
    const devScriptSrc = "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://va.vercel-scripts.com https://plugin.jup.ag https://*.reown.com https://*.walletconnect.org";

    // Production CSP - no unsafe-eval, much stricter
    const prodScriptSrc = "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://va.vercel-scripts.com https://plugin.jup.ag https://*.reown.com https://*.walletconnect.org";

    // Dedicated Gateway Domain
    const pinataGateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://indigo-historic-lark-315.mypinata.cloud';

    const cspValue = [
      // Default policy - only allow same-origin
      "default-src 'self'",

      // Script sources - environment dependent
      // ✅ FIXED: Added *.reown.com and *.walletconnect.org for mobile wallet SDKs
      isDevelopment ? devScriptSrc : prodScriptSrc,

      // Style sources - allow self, inline styles from Tailwind/styled-components
      // ✅ FIXED: Added *.reown.com for wallet styling
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.reown.com",

      // Image sources - allow self, data URIs, and HTTPS URLs
      `img-src 'self' data: blob: https: https://gateway.pinata.cloud ${pinataGateway}`,

      // Font sources - Added fonts.reown.com for Reown/WalletConnect fonts
      // ✅ FIXED: Added *.walletconnect.org for wallet fonts
      "font-src 'self' data: https://fonts.gstatic.com https://fonts.reown.com https://*.walletconnect.org",

      // ✅ NEW: Worker sources - CRITICAL for mobile wallet Web Workers
      // Mobile wallets use Web Workers for async operations
      "worker-src 'self' blob:",

      // ✅ NEW: Manifest sources - for wallet metadata/manifests
      "manifest-src 'self'",

      // Connect sources - WebSocket and API connections
      // ✅ FIXED: Added api.reown.com and improved wildcard matching
      `connect-src 'self' https: wss: ws: https://api.devnet.solana.com https://api.testnet.solana.com https://api.mainnet-beta.solana.com https://rpc.solana.com wss://api.devnet.solana.com wss://api.testnet.solana.com wss://api.mainnet-beta.solana.com wss://devnet.solana.com wss://testnet.solana.com wss://mainnet.solana.com https://*.helius.dev https://*.alchemy.com https://*.quicknode.com https://solscan.io https://pumpportal.fun https://pump.fun https://plugin.jup.ag https://va.vercel-scripts.com https://dexscreener.com https://api.pinata.cloud https://gateway.pinata.cloud ${pinataGateway} https://birdeye.so wss://relay.walletconnect.org https://relay.walletconnect.org https://*.walletconnect.org wss://*.walletconnect.org https://api.walletconnect.org https://api.reown.com https://*.reown.com wss://*.reown.com https://*.walletconnect.com wss://*.walletconnect.com`,

      // Frame sources - wallet iframes and external services
      // ✅ FIXED: Added support for Reown/WalletConnect iframes
      "frame-src 'self' https://*.reown.com https://*.walletconnect.org https://dexscreener.com https://birdeye.so",

      // ✅ NEW: Child frame navigation - allows nested frames from wallet providers
      "child-src 'self' https://*.reown.com https://*.walletconnect.org",

      // Frame ancestors - prevent clickjacking
      "frame-ancestors 'none'",

      // Base URI - restrict where the base tag can point
      "base-uri 'self'",

      // Form action - restrict form submissions
      "form-action 'self'",

      // ✅ NEW: Object sources - disable for security (prevent plugin execution)
      "object-src 'none'",

      // ✅ NEW: Media sources - for any wallet media
      "media-src 'self' https:",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspValue,
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;