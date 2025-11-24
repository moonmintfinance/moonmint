import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ReferralGenerator } from '@/components/Referralgenerator';

export const metadata = {
  title: 'Referral Program -Chad Mint',
  description: 'Earn 55% commissions by referring users toChad Mint. Create your referral link and start earning today.',
  keywords: 'referral, referral program, earn, affiliate, commission, solana, token',
};

export default function ReferralPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <ReferralGenerator />
      <Footer />
    </main>
  );
}