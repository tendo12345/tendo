import { Hero } from '../components/home/Hero';
import { HowItWorks } from '../components/home/HowItWorks';
import { WhatYouGet } from '../components/home/WhatYouGet';

export default function HomePage() {
  return (
    <div>
      <Hero />
      <HowItWorks />
      <WhatYouGet />
    </div>
  );
}
