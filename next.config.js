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
    ],
  },
  headers: async () => {
    // Build CSP based on environment
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Development CSP - allows HMR
    const devScriptSrc = "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://va.vercel-scripts.com https://plugin.jup.ag";

    // Production CSP - no unsafe-eval, much stricter
    const prodScriptSrc = "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://va.vercel-scripts.com https://plugin.jup.ag";

    const cspValue = [
      // Default policy - only allow same-origin scripts
      "default-src 'self'",

      // Script sources - environment dependent
      isDevelopment ? devScriptSrc : prodScriptSrc,

      // Style sources - allow self, inline styles from Tailwind/styled-components
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",

      // Image sources - allow self, data URIs, and HTTPS URLs including Pinata
      "img-src 'self' data: blob: https: https://gateway.pinata.cloud",

      // Font sources - allow Google Fonts and data URIs
      "font-src 'self' data: https://fonts.gstatic.com",

      // Connect sources - Solana RPC endpoints + Jupiter + DexScreener + Pinata API
      "connect-src 'self' https: https://api.devnet.solana.com https://api.testnet.solana.com https://api.mainnet-beta.solana.com https://rpc.solana.com wss://api.devnet.solana.com wss://api.testnet.solana.com wss://api.mainnet-beta.solana.com wss://devnet.solana.com wss://testnet.solana.com wss://mainnet.solana.com https://*.helius.dev https://*.alchemy.com https://*.quicknode.com https://solscan.io https://pumpportal.fun https://pump.fun https://plugin.jup.ag https://va.vercel-scripts.com https://dexscreener.com https://api.pinata.cloud https://gateway.pinata.cloud",

      // Frame sources - allow DexScreener charts
      "frame-src 'self' https://dexscreener.com",

      // Frame ancestors - prevent clickjacking
      "frame-ancestors 'none'",

      // Base URI - restrict where the base tag can point
      "base-uri 'self'",

      // Form action - restrict form submissions
      "form-action 'self'",
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