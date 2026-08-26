import { Navigate, NavLink, useParams } from 'react-router-dom';
import { ColorSystemSection } from '../components/result/ColorSystemSection';
import { ComponentPreviewSection } from '../components/result/ComponentPreviewSection';
import { ExportSection } from '../components/result/ExportSection';
import { LayoutSection } from '../components/result/LayoutSection';
import { LiveUIExampleSection } from '../components/result/LiveUIExampleSection';
import { OverviewSection } from '../components/result/OverviewSection';
import { ReasoningSection } from '../components/result/ReasoningSection';
import { ResultHeader } from '../components/result/ResultHeader';
import { TypographySection } from '../components/result/TypographySection';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { AccessibilityPane } from '../components/workspace/AccessibilityPane';
import { AiPane } from '../components/workspace/AiPane';
import { DecisionSummary } from '../components/workspace/DecisionSummary';
import { ExplorePane } from '../components/workspace/ExplorePane';
import { ImportPane } from '../components/workspace/ImportPane';
import { ModesPane } from '../components/workspace/ModesPane';
import { PatternsPane } from '../components/workspace/PatternsPane';
import { RegionNotice } from '../components/workspace/RegionNotice';
import { StatesPane } from '../components/workspace/StatesPane';
import { SystemDnaPanel } from '../components/workspace/SystemDnaPanel';
import { TokensPane } from '../components/workspace/TokensPane';
import { useGeneratedSystem } from '../context/GeneratedSystemContext';
import { WORKSPACE_SECTIONS } from '../types/ui';
import styles from './Workspace.module.css';

/**
 * The workspace shell.
 *
 * One section renders at a time, driven by the route, so switching sections does not
 * re-render the whole system. The engine is called once, in context â€” never here.
 */
export default function WorkspacePage() {
  const { section } = useParams<{ section: string }>();
  const { output, generatedAt, regenerate } = useGeneratedSystem();

  if (!output) {
    return (
      <div className={`container ${styles.emptyWrap}`}>
        <EmptyState
          title="Nothing generated yet"
          description="Start with a short product description and we'll put a complete design system together."
          action={
            <Button href="/generator" variant="primary">
              Go to Generator
            </Button>
          }
        />
      </div>
    );
  }

  const active = WORKSPACE_SECTIONS.find((s) => s.id === section);
  if (!active) return <Navigate to="/system/overview" replace />;

  return (
    <div>
      <ResultHeader output={output} generatedAt={generatedAt} onRegenerate={regenerate} />

      <nav className={styles.nav} aria-label="Workspace sections">
        <div className={`${styles.navInner} container hscroll`}>
          {WORKSPACE_SECTIONS.map((s) => (
            <NavLink
              key={s.id}
              to={`/system/${s.id}`}
              className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
            >
              {s.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="container">
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <ol className={styles.crumbs}>
            <li>
              <NavLink to="/generator" className={styles.crumbLink}>
                Generator
              </NavLink>
            </li>
            <li aria-hidden="true" className={styles.crumbSep}>
              /
            </li>
            <li>
              <span className={styles.crumbCurrent}>{output.category}</span>
            </li>
            <li aria-hidden="true" className={styles.crumbSep}>
              /
            </li>
            <li>
              <span className={styles.crumbCurrent} aria-current="page">
                {active.label}
              </span>
            </li>
          </ol>
        </nav>

        {/*
          Keyed on the section id so React remounts on every route change, which re-fires the
          entrance animation. Without the key the subtree is reused and the new section
          simply blinks into place — the switch reads as a jump rather than a turned page.
          `app-enter` is inert under prefers-reduced-motion via the global backstop.
        */}
        <div key={active.id} className="app-enter">
        {active.id === 'overview' && (
          <div className={`${styles.overview} app-stagger`}>
            <SystemDnaPanel output={output} />
            {/* Renders nothing unless a region was given. */}
            <RegionNotice output={output} />
            <OverviewSection output={output} />
            <DecisionSummary output={output} />
          </div>
        )}
        {active.id === 'tokens' && <TokensPane output={output} />}
        {active.id === 'colors' && <ColorSystemSection output={output} />}
        {active.id === 'modes' && <ModesPane output={output} />}
        {active.id === 'typography' && <TypographySection output={output} />}
        {active.id === 'layout' && <LayoutSection output={output} />}
        {active.id === 'components' && <ComponentPreviewSection output={output} />}
        {active.id === 'states' && <StatesPane output={output} />}
        {active.id === 'patterns' && <PatternsPane output={output} />}
        {active.id === 'accessibility' && <AccessibilityPane output={output} />}
        {active.id === 'explore' && <ExplorePane output={output} />}
        {active.id === 'reasoning' && <ReasoningSection output={output} />}
        {active.id === 'preview' && <LiveUIExampleSection output={output} />}
        {active.id === 'ai' && <AiPane output={output} />}
        {active.id === 'import' && <ImportPane />}
        {active.id === 'export' && <ExportSection output={output} />}
        </div>
      </div>
    </div>
  );
}
