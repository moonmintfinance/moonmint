'use client';

import { usePathname } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletButton } from '@/components/WalletButton';
import Image from 'next/image';
import { useState, useEffect } from 'react';

export function Header() {
  const pathname = usePathname();
  const { publicKey } = useWallet();
  const [activeSection, setActiveSection] = useState('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (pathname !== '/') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      {
        threshold: 0.3,
      }
    );

    const mintSection = document.getElementById('mint');
    if (mintSection) {
      observer.observe(mintSection);
    }

    return () => {
      if (mintSection) {
        observer.unobserve(mintSection);
      }
    };
  }, [pathname]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const isActive = (href: string) => {
    if (pathname === '/') {
      if (href === '/') {
        return activeSection !== 'mint';
      }
      if (href === '/#mint') {
        return activeSection === 'mint';
      }
      return false;
    }

    if (href === '/') {
      return pathname === '/';
    }

    if (href.startsWith('/#')) {
      return false;
    }

    return pathname.startsWith(href);
  };

  const navLinkClass = (href: string, isMobile = false) => {
    const isCurrentPage = isActive(href);

    if (isMobile) {
      return `block w-full py-3 px-4 rounded-none text-sm font-bold transition-all duration-200 uppercase tracking-wider ${
        isCurrentPage
          ? 'bg-primary-500/20 text-primary-400 border-l-2 border-primary-500'
          : 'text-gray-300 hover:bg-dark-200 hover:text-primary-500'
      }`;
    }

    return `text-sm font-bold transition-colors uppercase tracking-wider ${
      isCurrentPage
        ? 'text-primary-500'
        : 'text-gray-300 hover:text-primary-500'
    }`;
  };

  const navLinks = [
    { name: 'Home', href: '/' },
    { name: 'Create', href: '/#mint' },
    { name: 'New Tokens', href: '/new-tokens' },
    { name: 'Hot Tokens', href: '/hot' },
    { name: 'Swap', href: '/swap' },
    { name: 'Refer', href: '/referral' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm border-b border-primary-500/20">
      <div className="w-full px-4 md:px-6 py-3 md:py-4 relative z-50">
        <div className="flex items-center justify-between gap-2 md:gap-4">
          {/* Logo with Subtle Neon Glow */}
          <a href="/" className="block flex-shrink-0 group">
            <div className="flex items-center gap-2">
              {/* Logo Container with Subtle Glow */}
              <div className="w-8 h-8 md:w-10 md:h-10 relative flex-shrink-0">
                {/* Subtle glow on hover */}
                <div
                  className="absolute inset-0 bg-primary-500 rounded-full opacity-0 group-hover:opacity-20 blur-md transition-opacity duration-300"
                ></div>
                {/* Logo Image */}
                <Image
                  src="/Chadmint_logo1.png"
                  alt="Chad Mint Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <h1 className="text-lg md:text-xl font-black text-white uppercase tracking-tighter">
                ChadMint
              </h1>
            </div>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8 flex-1 justify-center px-8">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className={navLinkClass(link.href)}
              >
                {link.name}
              </a>
            ))}
          </nav>

          {/* Wallet & Mobile Menu Toggle */}
          <div className="flex items-center gap-2">
            <div className="wallet-button-container">
              <WalletButton />
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 text-primary-500 hover:bg-primary-500/10 rounded-none transition-colors focus:outline-none flex-shrink-0 border border-primary-500/30"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu Content */}
        {isMobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 top-[60px] bg-black/80 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-hidden="true"
            />

            <div className="absolute top-full left-0 right-0 p-3 md:hidden z-50 mt-1">
              <div className="bg-dark-200 border border-primary-500/30 rounded-none shadow-2xl shadow-black/50 overflow-hidden animate-fadeIn">
                <nav className="flex flex-col p-2 space-y-1">
                  {navLinks.map((link) => (
                    <a
                      key={link.name}
                      href={link.href}
                      className={navLinkClass(link.href, true)}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {link.name}
                    </a>
                  ))}
                </nav>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
}