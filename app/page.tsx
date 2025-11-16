import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { TokenMinter } from '@/components/TokenMinter';
import { Footer } from '@/components/Footer';

export default function Home() {
  return (
    <main className="min-h-screen">
      <Header />
      <Hero />
      <TokenMinter />
      <Footer />
    </main>
  );
}