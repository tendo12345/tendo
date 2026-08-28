import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';
import { listModerationQueue, moderateComment, type Comment } from '../lib/comments';
import { Badge } from '../components/ui/Badge';
import NotFoundPage from './NotFound';
import styles from './AdminComments.module.css';

/**
 * The moderation queue. The `isAdmin` check below is a UX nicety only — it hides the route
 * for a non-admin rather than showing a "you're not authorized" message, so its existence
 * isn't advertised. Real enforcement is the "admin moderate comment" / "read visible or own
 * or admin" RLS policies in supabase/schema.sql: a non-admin who hits these queries directly
 * gets empty results or a rejected write from Postgres regardless of what this page renders.
 */
export default function AdminCommentsPage() {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const [queue, setQueue] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!supabase) return;
    setLoading(true);
    listModerationQueue(supabase)
      .then(setQueue)
      .catch((err: Error) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  if (!isAdmin) {
    return <NotFoundPage />;
  }

  const moderate = async (id: string, action: 'approve' | 'remove') => {
    if (!supabase) return;
    setBusyId(id);
    try {
      await moderateComment(supabase, id, action);
      setQueue((prev) => prev.filter((c) => c.id !== id));
      showToast(action === 'approve' ? 'Comment approved' : 'Comment removed', 'success');
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={`container ${styles.wrap}`}>
      <h1 className={styles.title}>Moderation Queue</h1>
      <p className={styles.meta}>Comments reported by users, or already removed, awaiting review.</p>

      {loading ? (
        <p className={styles.empty}>Loading…</p>
      ) : queue.length === 0 ? (
        <p className={styles.empty}>Nothing to review.</p>
      ) : (
        <ul className={styles.list}>
          {queue.map((comment) => (
            <li key={comment.id} className={styles.item}>
              <div className={styles.itemHead}>
                <span className={styles.postSlug}>{comment.postSlug}</span>
                <Badge tone={comment.status === 'removed' ? 'negative' : 'warning'}>{comment.status}</Badge>
                <span className={styles.reportCount}>{comment.reportCount} report(s)</span>
              </div>
              <p className={styles.author}>{comment.authorName}</p>
              <p className={styles.text}>{comment.body}</p>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.action}
                  onClick={() => void moderate(comment.id, 'approve')}
                  disabled={busyId === comment.id}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className={styles.action}
                  onClick={() => void moderate(comment.id, 'remove')}
                  disabled={busyId === comment.id}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
