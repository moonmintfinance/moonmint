// components/FloatingBotButton.tsx
'use client';

import { useState } from 'react';
import { BotChat } from './BotChat';

export function FloatingBotButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Button - Always visible in bottom right */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-gradient-to-br from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500 rounded-full shadow-lg shadow-primary-500/50 flex items-center justify-center transition-all duration-200 hover:scale-110 group border-2 border-primary-400/20"
        title="Open FAQ Bot"
      >
        <div className="text-center">
          <div className="text-xs font-bold text-black whitespace-nowrap leading-none">FAQ</div>
        </div>

        {/* Pulsing indicator dot */}
        <div className="absolute top-1 right-1 w-2 h-2 bg-white rounded-full animate-pulse"></div>
      </button>

      {/* Chat Modal - Slides in from bottom right */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 animate-fadeIn"
          onClick={() => setIsOpen(false)}
        >
          {/* Modal Container */}
          <div
            className="fixed bottom-6 right-6 w-96 h-[600px] bg-dark-100 border border-primary-500/30 rounded-2xl shadow-2xl shadow-black/50 flex flex-col animate-fadeIn z-50"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 z-10 w-8 h-8 bg-dark-200 hover:bg-dark-300 text-gray-400 hover:text-white rounded-full flex items-center justify-center transition-colors border border-dark-300"
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Chat Content */}
            <div className="p-6 flex flex-col h-full">
              <BotChat />
            </div>
          </div>
        </div>
      )}
    </>
  );
}