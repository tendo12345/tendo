import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { accountsEnabled } from '../lib/supabase';
import { storePendingGeneration } from '../lib/pendingGeneration';
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
  const { status } = useAuth();
  const navigate = useNavigate();

  /*
    Generation is gated behind an account.

    Two conditions, and the second is not optional. `accountsEnabled()` is false whenever the
    deployment has no Supabase project — the documented, supported state this repo keeps working
    on purpose. Gating on `signed-out` alone would make the generator unreachable there: no auth
    to complete, no way past the redirect, and the core product dead in a configuration the
    codebase explicitly supports. So the gate only exists where there is an account to sign in
    to.

    `status` is 'loading' until the session resolves, and loading is not signed-out. Treating it
    as such would bounce a signed-in visitor to /account for the moment before their session
    arrives.
  */
  const requiresSignIn = accountsEnabled() && status === 'signed-out';

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

    /*
      Hold the input across the redirect, so signing in finishes the job the visitor started
      rather than dropping them on an account page with an empty form waiting behind it.
      Account picks it up and continues to the workspace.
    */
    if (requiresSignIn) {
      storePendingGeneration(result.input);
      navigate('/account');
      return;
    }

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
            {requiresSignIn ? 'Sign In to Generate' : 'Generate Design System'}
          </Button>
          {/*
            Say where the button goes before it goes there. A control labelled "Generate" that
            navigates to a sign-in page is a small lie, and it is the kind users remember.
          */}
          {requiresSignIn && (
            <p className={styles.gateNote}>
              You will come straight back to your system after signing in.
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
