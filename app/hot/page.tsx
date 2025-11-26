'use client';

import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Hot25Tokens } from '@/components/Hot25Tokens';

export default function Hot25Page() {
  return (
    <main className="min-h-screen flex flex-col bg-gradient-dark">
      <Header />
      <div className="flex-grow">
        <Hot25Tokens />
      </div>
      <Footer />
    </main>
  );
}