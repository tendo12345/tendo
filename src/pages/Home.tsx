import { Hero } from '../components/home/Hero';
import { HowItWorks } from '../components/home/HowItWorks';
import { PipelineDiagram } from '../components/home/PipelineDiagram';
import { WhatYouGet } from '../components/home/WhatYouGet';

export default function HomePage() {
  return (
    <div>
      <Hero />
      <div className="container">
        <PipelineDiagram />
      </div>
      <HowItWorks />
      <WhatYouGet />
    </div>
  );
}
