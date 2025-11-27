// components/BotChat.tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  role: 'user' | 'bot';
  text: string;
  timestamp: Date;
}

export function BotChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'bot',
      text: '🌙 Welcome to Chad Mint! Ask me anything about creating Solana tokens, our referral program, or security features.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    const loadingToast = toast.loading('Thinking...');

    // ✅ Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/bot-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
        }),
        signal: abortControllerRef.current.signal, // ✅ Pass signal
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to get response');
      }

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        text: data.response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, botMessage]);
      toast.success('Response received', { id: loadingToast });
    } catch (error) {
      console.error('Chat error:', error);

      // ✅ Handle abort gracefully
      if (error instanceof Error && error.name === 'AbortError') {
        toast.error('Request cancelled', { id: loadingToast });
      } else {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        toast.error(`Failed to send message: ${errorMsg}`, { id: loadingToast });
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  // ✅ Cancel request if component unmounts
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="pb-4 border-b border-primary-500/30">
        <h2 className="text-xl font-bold text-white">🌙 Chad Mint FAQ</h2>
        <p className="text-xs text-gray-400">Ask about tokens, referrals & more</p>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2 py-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 text-sm ${
                msg.role === 'user'
                  ? 'bg-primary-500 text-black font-medium'
                  : 'bg-dark-50 text-gray-100 border border-dark-200'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.text}</p>
              <span className="text-xs opacity-70 mt-1 block">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-dark-50 text-gray-100 border border-dark-200 rounded-lg p-3">
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={sendMessage} className="flex gap-2 pt-4 border-t border-primary-500/30 mt-auto">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          className="flex-1 min-w-0 bg-dark-50 border border-primary-500/30 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 placeholder-gray-500 disabled:opacity-50"
          disabled={loading}
          maxLength={500}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="flex-shrink-0 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold px-4 py-2 rounded-lg transition-colors whitespace-nowrap text-sm"
        >
          {loading ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
}