import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExamplePrompts } from '../components/generator/ExamplePrompts';
import { IndustryInput } from '../components/generator/IndustryInput';
import { KeywordChips } from '../components/generator/KeywordChips';
import { ProductTypeCombobox } from '../components/generator/ProductTypeCombobox';
import { RegionInput } from '../components/generator/RegionInput';
import { Button } from '../components/ui/Button';
import { useGeneratedSystem } from '../context/GeneratedSystemContext';
import { buildGenerateInput } from '../lib/buildGenerateInput';
import styles from './Generator.module.css';

export default function GeneratorPage() {
  const [productType, setProductType] = useState('');
  const [industry, setIndustry] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [region, setRegion] = useState('');
  const [error, setError] = useState<string | undefined>();

  const { generate } = useGeneratedSystem();
  const navigate = useNavigate();

  /*
    Generate and go, with no interstitial.

    This used to hold a `pendingInput` and run a six-step progress list for about 1.3s —
    "Understanding product type", "Selecting palette" — and only call `generate()` once the
    list finished. Nothing was happening during it. The engine is synchronous and
    client-side: it runs in microseconds, after the animation, so the list was describing
    work that had not started and would never take that long.

    That is the fake-loading pattern this codebase exists to argue against, and it sat in the
    one moment users look at hardest. The transition is now carried by the workspace revealing
    itself, which is honest — staging the presentation of a result that already exists is not
    the same as pretending to compute it.
  */
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const result = buildGenerateInput({ productType, industry, keywords, region });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(undefined);
    generate(result.input);
    navigate('/system/overview');
  };

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.header}>
        <p className={styles.eyebrow}>Design System Generator</p>
        <h1 className={styles.title}>Create Your Design System</h1>
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
