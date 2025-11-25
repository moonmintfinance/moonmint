'use client';

import Image from 'next/image';

export function Hero() {
  return (
    <section
      id="home"
      className="flex flex-col justify-center min-h-screen px-4 pt-24 pb-8 md:px-6 md:pt-32 md:pb-20 bg-black"
    >
      <div className="container mx-auto max-w-6xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-12">
          {/* Left Column: Text Content */}
          <div className="flex-1 text-center md:text-left space-y-4 md:space-y-8">
            {/* Status Badge */}
            <div className="flex justify-center md:justify-start">
              <div className="inline-flex items-center gap-2 px-4 py-2 border border-primary-500/50 rounded-full bg-primary-500/5">
                <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse"></div>
                <span className="text-xs font-mono text-primary-500 uppercase tracking-wider">
                  System Online: Based
                </span>
              </div>
            </div>

            {/* Main Headline */}
            <div>
              <h1 className="text-5xl md:text-7xl font-black text-white leading-tight mb-2 md:mb-4 tracking-tighter">
                Mint
                <span className="block text-primary-500 neon-text mt-2">
                  ALPHA
                </span>
              </h1>
              <h2 className="text-3xl md:text-5xl font-black text-primary-500 mb-6 md:mb-8 neon-text tracking-tighter">
                Snipe
              </h2>
              <p className="text-base md:text-lg text-gray-300 leading-relaxed max-w-lg mx-auto md:mx-0 font-mono">
                Mint tokens instantly. Snipe based coins. Refer chads.
              </p>
            </div>

            {/* Desktop Call to Action */}
            <div className="hidden md:flex items-center gap-4 pt-4">
              <a
                href="#mint"
                className="inline-block bg-primary-500 hover:bg-primary-400 active:bg-primary-600 text-black font-black py-4 px-12 rounded-none transition-all duration-200 hover:shadow-lg hover:shadow-primary-500/40 text-lg tracking-wide"
              >
                START MINTING
              </a>
              <a
                href="/referral"
                className="inline-block bg-transparent border-2 border-primary-500/70 text-primary-500 hover:border-primary-400 hover:bg-primary-500/5 font-bold py-4 px-12 rounded-none transition-all duration-200 text-lg tracking-wide"
              >
                REFERRAL LINK
              </a>
            </div>
          </div>

          {/* Right Column: Hero Image & Mobile Button */}
          <div className="flex-1 flex flex-col items-center justify-center w-full">
            {/* Reduced image size for mobile */}
            <div className="relative w-[260px] h-[260px] md:w-[500px] md:h-[500px] mt-2 md:mt-0">
              <div className="absolute inset-0 bg-primary-500/20 blur-[80px] md:blur-[120px] rounded-full mix-blend-screen animate-pulse"></div>
              <Image
                src="/Chadmint_logo1.png"
                alt="Chad Mint Logo"
                fill
                sizes="(max-width: 768px) 260px, 500px"
                className="object-contain animate-float relative"
                priority
              />
            </div>

            {/* Mobile Call to Action */}
            <div className="block md:hidden w-full max-w-xs mt-8 space-y-3">
              <a
                href="#mint"
                className="block w-full text-center bg-primary-500 hover:bg-primary-400 active:bg-primary-600 text-black font-black py-4 px-8 rounded-none transition-all duration-200 active:scale-[0.98] shadow-lg shadow-primary-500/40 uppercase tracking-wide text-sm"
              >
                Start Minting
              </a>
              <a
                href="/referral"
                className="block w-full text-center bg-transparent border-2 border-primary-500/70 text-primary-500 hover:border-primary-400 hover:bg-primary-500/5 font-bold py-4 px-8 rounded-none transition-all duration-200 active:scale-[0.98] uppercase tracking-wide text-sm"
              >
                Referral Link
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}