'use client';

import { usePathname } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletButton } from '@/components/WalletButton';
import { useState, useEffect } from 'react';

export function Header() {
  const pathname = usePathname();
  const { publicKey } = useWallet();
  const [activeSection, setActiveSection] = useState('home');

  // Detect which section is in view
  useEffect(() => {
    // Only track sections on home page
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
        threshold: 0.3, // Trigger when 30% of the section is visible
      }
    );

    // Observe the mint section
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

  const isActive = (href: string) => {
    // If we're on home page, check which section is in view
    if (pathname === '/') {
      if (href === '/') {
        return activeSection !== 'mint';
      }
      if (href === '/#mint') {
        return activeSection === 'mint';
      }
      return false;
    }

    // For other pages, standard route matching
    if (href === '/') {
      return pathname === '/';
    }

    if (href.startsWith('/#')) {
      return false;
    }

    return pathname.startsWith(href);
  };

  const navLinkClass = (href: string) => {
    const isCurrentPage = isActive(href);
    return `text-sm font-medium transition-colors ${
      isCurrentPage
        ? 'text-primary-400 hover:text-primary-300'
        : 'text-gray-300 hover:text-white'
    }`;
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-dark-50/95 backdrop-blur-md border-b border-dark-200">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <a href="/" className="block">
              <div className="flex flex-col">
                <h1 className="text-lg font-semibold text-white">Moon Mint</h1>
                <p className="text-xs text-gray-400">Make the next moon shot</p>
              </div>
            </a>
          </div>

          <nav className="hidden md:flex items-center space-x-8">
            <a
              href="/"
              className={navLinkClass('/')}
            >
              Home
            </a>
            <a
              href="/#mint"
              className={navLinkClass('/#mint')}
            >
              Create Token
            </a>
            <a
              href="/swap"
              className={navLinkClass('/swap')}
            >
              Swap
            </a>
            <a
              href="/referral"
              className={navLinkClass('/referral')}
            >
              Referral Program
            </a>
          </nav>

          <div className="wallet-button-container">
            <WalletButton />
          </div>
        </div>
      </div>
    </header>
  );
}