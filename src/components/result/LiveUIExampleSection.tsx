import type { DesignSystemOutput } from '../../engine/types';
import { DesignSystemScope } from './DesignSystemScope';
import ds from './dsPreview.module.css';
import result from './result.module.css';
import styles from './LiveUIExampleSection.module.css';

interface LiveUIExampleSectionProps {
  output: DesignSystemOutput;
}

type Variant = 'fintech' | 'saas' | 'ecommerce' | 'portfolio' | 'generic';

function pickVariant(category: string): Variant {
  const c = category.toLowerCase();
  if (/fintech|financial|crypto|bank/.test(c)) return 'fintech';
  if (/saas|dashboard|analytic/.test(c)) return 'saas';
  if (/e-?commerce|shop|store|retail|marketplace/.test(c)) return 'ecommerce';
  if (/portfolio|agency|creative/.test(c)) return 'portfolio';
  return 'generic';
}

function FintechMock() {
  return (
    <div className={styles.mockGrid}>
      <div className={ds.card}>
        <p className={ds.tileSub}>Total balance</p>
        <p className={ds.heading} style={{ fontSize: '1.8rem', fontWeight: 700 }}>
          $12,480.55
        </p>
        <div className={styles.mockRow} style={{ marginTop: '0.75rem' }}>
          <button type="button" className={ds.button}>
            Send money
          </button>
          <span className={ds.badge}>+2.4%</span>
        </div>
      </div>
      <div className={ds.card}>
        <p className={ds.tileHeading}>Recent activity</p>
        {['Spotify', 'Payroll', 'Rent'].map((label) => (
          <div key={label} className={styles.mockRow}>
            <span className={ds.tileSub}>{label}</span>
            <span className={ds.tileSub}>—$24.00</span>
          </div>
        ))}
      </div>
      <div className={ds.card}>
        <p className={ds.tileHeading}>Transactions</p>
        <table className={ds.table}>
          <tbody>
            <tr>
              <td>Coffee</td>
              <td>-$4.50</td>
            </tr>
            <tr>
              <td>Transfer</td>
              <td>+$200.00</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SaasMock() {
  return (
    <div className={styles.mockGrid}>
      <div className={styles.mockCol}>
        <p className={ds.tileHeading}>Sidebar</p>
        <nav className={ds.navRow} aria-label="Preview sidebar" style={{ flexDirection: 'column', border: 'none', padding: 0 }}>
          <span className={ds.navItemActive}>Overview</span>
          <span>Reports</span>
          <span>Team</span>
        </nav>
      </div>
      <div className={ds.card}>
        <p className={ds.tileSub}>Active users</p>
        <p className={ds.heading} style={{ fontSize: '1.8rem', fontWeight: 700 }}>
          8,204
        </p>
        <span className={ds.badge}>+12%</span>
      </div>
      <div className={ds.card}>
        <p className={ds.tileHeading}>Weekly trend</p>
        <div className={styles.mockRow} style={{ alignItems: 'flex-end', height: '4rem' }}>
          {[30, 55, 40, 70, 60, 90, 75].map((h, i) => (
            <span
              key={i}
              style={{ width: '10%', height: `${h}%`, background: 'var(--ds-primary)', borderRadius: '3px' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function EcommerceMock() {
  return (
    <div className={styles.mockGrid}>
      <div className={ds.card}>
        <div className={styles.line} style={{ height: '5rem', marginBottom: '0.6rem' }} />
        <p className={ds.tileHeading}>Studio Desk Lamp</p>
        <p className={ds.tileSub}>$89.00</p>
        <button type="button" className={ds.button} style={{ marginTop: '0.6rem' }}>
          Add to cart
        </button>
      </div>
      <div className={ds.card}>
        <p className={ds.tileHeading}>Your cart</p>
        <div className={styles.mockRow}>
          <span className={ds.tileSub}>Desk Lamp × 1</span>
          <span className={ds.tileSub}>$89.00</span>
        </div>
        <div className={styles.mockRow}>
          <span className={ds.tileSub}>Shipping</span>
          <span className={ds.tileSub}>$6.00</span>
        </div>
      </div>
      <div className={ds.card}>
        <p className={ds.tileHeading}>Checkout</p>
        <input className={ds.input} placeholder="Card number" style={{ marginBottom: '0.5rem' }} />
        <button type="button" className={ds.button}>
          Pay $95.00
        </button>
      </div>
    </div>
  );
}

function PortfolioMock() {
  return (
    <div className={styles.mockCol}>
      <div>
        <p className={ds.heading} style={{ fontSize: '1.8rem', fontWeight: 700 }}>
          Hi, I design digital products.
        </p>
        <p className={ds.tileSub}>Selected work, 2023 — 2026.</p>
      </div>
      <div className={styles.mockGrid}>
        {['Wayfare', 'Northline', 'Fielddesk'].map((project) => (
          <div key={project} className={ds.card}>
            <div className={styles.line} style={{ height: '4rem', marginBottom: '0.5rem' }} />
            <p className={ds.tileHeading}>{project}</p>
            <p className={ds.tileSub}>Case study</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function GenericMock({ output }: { output: DesignSystemOutput }) {
  return (
    <div className={styles.mockCol}>
      <div>
        <p className={ds.heading} style={{ fontSize: '1.8rem', fontWeight: 700 }}>
          {output.category}
        </p>
        <p className={ds.tileSub}>{output.pattern.sections}</p>
        <button type="button" className={ds.button} style={{ marginTop: '0.6rem' }}>
          Get started
        </button>
      </div>
      <div className={styles.mockGrid}>
        {[1, 2, 3].map((i) => (
          <div key={i} className={ds.card}>
            <div className={styles.line} style={{ width: '60%', marginBottom: '0.5rem' }} />
            <div className={styles.line} style={{ width: '90%' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function LiveUIExampleSection({ output }: LiveUIExampleSectionProps) {
  const variant = pickVariant(output.category);

  return (
    <div>
      <p className={result.subheading}>Live example — {output.category}</p>
      <DesignSystemScope output={output}>
        <div className={styles.frame}>
          <div className={styles.frameBar}>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>
          <div className={styles.mockBody} style={{ background: 'var(--ds-background)' }}>
            {variant === 'fintech' && <FintechMock />}
            {variant === 'saas' && <SaasMock />}
            {variant === 'ecommerce' && <EcommerceMock />}
            {variant === 'portfolio' && <PortfolioMock />}
            {variant === 'generic' && <GenericMock output={output} />}
          </div>
        </div>
      </DesignSystemScope>
    </div>
  );
}
