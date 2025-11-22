'use client';

import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import MeteoraPools from '@/components/MeteoraPools';

export default function NewTokensPage() {
  return (
    <main className="min-h-screen flex flex-col bg-gradient-dark">
      <Header />
      <MeteoraPools />
      <Footer />
    </main>
  );
}