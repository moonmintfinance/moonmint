'use client';

import { usePathname } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletButton } from '@/components/WalletButton';
import { useState, useEffect } from 'react';

export function Header() {
  const pathname = usePathname();
  const { publicKey } = useWallet();
  const [activeSection, setActiveSection] = useState('home');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
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

  const navLinkClass = (href: string, isMobile = false) => {
    const isCurrentPage = isActive(href);

    if (isMobile) {
      // Mobile styles - darker background when active, no transparency issues
      return `block w-full py-3 px-4 rounded-xl text-base font-medium transition-all duration-200 ${
        isCurrentPage
          ? 'bg-primary-500/20 text-primary-400 border border-primary-500/20'
          : 'text-gray-300 hover:bg-dark-200 hover:text-white'
      }`;
    }

    // Desktop styles
    return `text-sm font-medium transition-colors ${
      isCurrentPage
        ? 'text-primary-400 hover:text-primary-300'
        : 'text-gray-300 hover:text-white'
    }`;
  };

  const navLinks = [
    { name: 'Home', href: '/' },
    { name: 'Create Token', href: '/#mint' },
    { name: 'New tokens', href: '/new-tokens' },
    { name: 'Swap', href: '/swap' },
    { name: 'Referral Program', href: '/referral' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-dark-50/95 backdrop-blur-md border-b border-dark-200">
      {/* Ensure header content sits above the backdrop */}
      <div className="container mx-auto px-6 py-4 relative z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <a href="/" className="block">
              <div className="flex flex-col">
                <h1 className="text-lg font-semibold text-white">Chad Mint</h1>
                <p className="text-xs text-gray-400">Make the next moon shot</p>
              </div>
            </a>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
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
          <div className="flex items-center gap-3">
            <div className="wallet-button-container">
              <WalletButton />
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 text-gray-300 hover:text-white hover:bg-dark-200 rounded-lg transition-colors focus:outline-none"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu Content */}
        {isMobileMenuOpen && (
          <>
            {/* Backdrop: Fixed full screen overlay to blur the rest of the content */}
            <div
              className="fixed inset-0 top-[72px] bg-black/80 backdrop-blur-md z-40 md:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-hidden="true"
            />

            {/* Menu Dropdown: Solid background, no transparency */}
            <div className="absolute top-full left-0 right-0 p-4 md:hidden z-50">
              <div className="bg-dark-100 border border-dark-200 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden animate-fadeIn">
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