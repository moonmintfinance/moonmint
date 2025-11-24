import { FaTelegram, FaGithub } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';

export function Footer() {
  return (
    <footer className="py-12 px-6 border-t border-dark-200">
      <div className="container mx-auto">
        {/* Updated from md:grid-cols-2 to md:grid-cols-3 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* --- COLUMN 1 --- */}
          <div>
            <h3 className="font-semibold text-white mb-2">Chad Mint</h3>
            <p className="text-sm text-gray-400">
              Make the next moon shot
            </p>
          </div>

          {/* --- COLUMN 2 --- */}
          <div>
            <h4 className="font-semibold text-white mb-4">Resources</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <a
                  href="https://docs.solana.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Solana Documentation
                </a>
              </li>
              <li>
                <a
                  href="https://spl.solana.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  SPL Token Program
                </a>
              </li>
              <li>
                <a
                  href="https://explorer.solana.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Solana Explorer
                </a>
              </li>
            </ul>
          </div>

          {/* --- NEWLY ADDED COLUMN 3 --- */}
          <div>
            <h4 className="font-semibold text-white mb-4">Community</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <a
                  href="https://x.com/MoonMintFinance"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors flex items-center"
                >
                  <FaXTwitter className="w-4 h-4 mr-2" />
                  Twitter
                </a>
              </li>
              <li>
                <a
                  href="https://t.me/+cumdynQc6DExMDBh"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors flex items-center"
                >
                  <FaTelegram className="w-4 h-4 mr-2" />
                  Telegram
                </a>
              </li>
              <li>
                  <a
                  href="https://github.com/moonmintfinance/moonmint/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors flex items-center"
                >
                  <FaGithub className="w-4 h-4 mr-2" />
                  GitHub
                </a>
              </li>
            </ul>
          </div>

        </div>

        <div className="pt-8 border-t border-dark-200 text-center text-sm text-gray-400">
          <p>© 2025 Chad Mint. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}