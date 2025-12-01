import { FaTelegram, FaGithub } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import Image from 'next/image';
import { BRANDING_CONFIG, SOCIAL_CONFIG } from '@/lib/constants';

export function Footer() {
  return (
    <footer className="py-12 px-6 border-t border-primary-500/20 bg-black">
      <div className="container mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Column 1 */}
          <div>
            <div className="flex items-center gap-2 mb-2 group">
              {/* Logo with Subtle Neon Glow */}
              <div className="w-6 h-6 relative flex-shrink-0">
                {/* Subtle glow on hover */}
                <div
                  className="absolute inset-0 bg-primary-500 rounded-full opacity-0 group-hover:opacity-20 blur-md transition-opacity duration-300"
                ></div>
                {/* Logo Image */}
                <Image
                  src={BRANDING_CONFIG.LOGO}
                  alt={`${BRANDING_CONFIG.NAME} Logo`}
                  fill
                  className="object-contain"
                />
              </div>
              <h3 className="font-black text-white uppercase tracking-tighter">{BRANDING_CONFIG.NAME}</h3>
            </div>
            <p className="text-sm text-gray-400 font-mono">
              Mint. Alpha. Snipe.
            </p>
          </div>

          {/* Column 2 */}
          <div>
            <h4 className="font-bold text-white mb-4 uppercase tracking-wide">Notices</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <a
                  href="/THIRD_PARTY_NOTICES.txt"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary-500 transition-colors font-mono"
                >
                  Third Party Notices
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3 */}
          <div>
            <h4 className="font-bold text-white mb-4 uppercase tracking-wide">Community</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <a
                  href={SOCIAL_CONFIG.TWITTER}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary-500 transition-colors flex items-center font-mono"
                >
                  <FaXTwitter className="w-4 h-4 mr-2" />
                  Twitter
                </a>
              </li>
              <li>
                <a
                  href={SOCIAL_CONFIG.TELEGRAM}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary-500 transition-colors flex items-center font-mono"
                >
                  <FaTelegram className="w-4 h-4 mr-2" />
                  Telegram
                </a>
              </li>
              <li>
                <a
                  href={SOCIAL_CONFIG.GITHUB}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary-500 transition-colors flex items-center font-mono"
                >
                  <FaGithub className="w-4 h-4 mr-2" />
                  GitHub
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-primary-500/20 text-center text-sm text-gray-400 font-mono">
          <p>© 2025 {BRANDING_CONFIG.NAME}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}