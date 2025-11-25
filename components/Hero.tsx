import Image from 'next/image';

export function Hero() {
  return (
    <section
      id="home"
      className="flex flex-col justify-center min-h-screen px-4 pt-24 pb-8 md:px-6 md:pt-32 md:pb-20"
    >
      <div className="container mx-auto max-w-6xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-12">
          {/* Left Column: Text Content */}
          <div className="flex-1 text-center md:text-left space-y-4 md:space-y-8">
            <div>
              <h1 className="text-4xl md:text-7xl font-bold text-white leading-tight mb-2 md:mb-4">
                Chad Mint
                <span className="block text-primary-400 text-2xl md:text-5xl mt-2">
                  Don't just launch. Dominate.
                </span>
              </h1>
              <p className="text-base md:text-xl text-gray-400 leading-relaxed max-w-lg mx-auto md:mx-0">
                Become the based dev your community wants.
              </p>
            </div>

            {/* Desktop Call to Action */}
            <div className="hidden md:flex items-center gap-4">
              <a
                href="#mint"
                className="inline-block bg-primary-500 hover:bg-primary-600 text-white font-bold py-4 px-12 rounded-xl transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-primary-500/20"
              >
                Mint Your Token Now
              </a>
              <a
                href="/referral"
                className="inline-block bg-transparent border border-primary-400 text-primary-400 hover:bg-primary-500/10 font-bold py-4 px-12 rounded-xl transition-all duration-200 hover:scale-105"
              >
                Earn With Referrals
              </a>
            </div>
          </div>

          {/* Right Column: Hero Image & Mobile Button */}
          <div className="flex-1 flex flex-col items-center justify-center w-full">
            {/* Reduced image size for mobile to pull content up */}
            <div className="relative w-[260px] h-[260px] md:w-[650px] md:h-[650px] mt-2 md:mt-0">
              <div className="absolute inset-0 bg-primary-500/10 blur-[60px] md:blur-[80px] rounded-full mix-blend-screen"></div>
              <Image
                src="/Chadmint_logo1.png"
                alt="Chad Mint Logo"
                fill
                sizes="(max-width: 768px) 260px, 650px"
                className="object-contain animate-float relative"
                priority
              />
            </div>

            {/* Mobile Call to Action */}
            <div className="block md:hidden w-full max-w-xs mt-6 space-y-3">
              <a
                href="#mint"
                className="block w-full text-center bg-primary-500 hover:bg-primary-600 text-white font-bold py-3 px-8 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary-500/20"
              >
                Start Minting
              </a>
              <a
                href="/referral"
                className="block w-full text-center bg-transparent border border-primary-400 text-primary-400 hover:bg-primary-500/10 font-bold py-3 px-8 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                Earn With Referrals
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}