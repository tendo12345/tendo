import { useEffect, useRef } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { useGeneratedSystem } from '../context/GeneratedSystemContext';
import { decodeShareParams } from '../lib/shareLink';

/**
 * Opens a shared link.
 *
 * The link carries only the input, so this regenerates rather than fetching. That is why a
 * share link never expires and needs no storage behind it — but it also means a link made
 * before an engine change may render slightly differently than it did for its author.
 */
export default function SharePage() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const { generate } = useGeneratedSystem();
  const input = decodeShareParams(search);
  const generated = useRef(false);

  useEffect(() => {
    if (!input || generated.current) return;
    // Guarded: generating twice would be harmless (the engine is deterministic) but would
    // reset the workspace under anyone who navigated onward.
    generated.current = true;
    generate(input);
    navigate('/system/overview', { replace: true });
  }, [input, generate, navigate]);

  if (!input) {
    return (
      <div className="container" style={{ paddingBlock: 'var(--app-space-2xl)' }}>
        <EmptyState
          title="That link is missing its description"
          description="A shared Basis link carries the product description that generated the system. This one has none, so there is nothing to rebuild."
          action={
            <Button href="/generator" variant="primary">
              Generate one instead
            </Button>
          }
        />
      </div>
    );
  }

  return <Navigate to="/system/overview" replace />;
}
