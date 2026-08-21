import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExamplePrompts } from '../components/generator/ExamplePrompts';
import { GenerationSequence } from '../components/generator/GenerationSequence';
import { IndustryInput } from '../components/generator/IndustryInput';
import { KeywordChips } from '../components/generator/KeywordChips';
import { ProductTypeCombobox } from '../components/generator/ProductTypeCombobox';
import { RegionInput } from '../components/generator/RegionInput';
import { Button } from '../components/ui/Button';
import { useGeneratedSystem } from '../context/GeneratedSystemContext';
import { buildGenerateInput } from '../lib/buildGenerateInput';
import type { GenerateInput } from '../engine/types';
import styles from './Generator.module.css';

export default function GeneratorPage() {
  const [productType, setProductType] = useState('');
  const [industry, setIndustry] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [region, setRegion] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [pendingInput, setPendingInput] = useState<GenerateInput | null>(null);

  const { generate } = useGeneratedSystem();
  const navigate = useNavigate();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const result = buildGenerateInput({ productType, industry, keywords, region });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(undefined);
    setPendingInput(result.input);
  };

  const handleSequenceComplete = () => {
    if (!pendingInput) return;
    generate(pendingInput);
    navigate('/system/overview');
  };

  if (pendingInput) {
    return (
      <div className="container">
        <GenerationSequence onComplete={handleSequenceComplete} />
      </div>
    );
  }

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.header}>
        <p className={styles.eyebrow}>Design System Generator</p>
        <h1 className={styles.title}>Create your design system</h1>
        <p className={styles.subtitle}>Tell us what you're building. We'll handle the design decisions.</p>
      </div>

      <ExamplePrompts onSelect={setProductType} />

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <ProductTypeCombobox value={productType} onChange={setProductType} error={error} />
        <IndustryInput value={industry} onChange={setIndustry} />
        <KeywordChips value={keywords} onChange={setKeywords} />
        <RegionInput value={region} onChange={setRegion} />

        <div className={styles.submitRow}>
          <Button type="submit" variant="primary">
            Generate Design System
          </Button>
        </div>
      </form>
    </div>
  );
}
