import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { accountsEnabled } from '../../lib/supabase';
import {
  deleteComment,
  editComment,
  listComments,
  postComment,
  reportComment,
  subscribeToPostComments,
  type Comment,
} from '../../lib/comments';
import { CommentForm } from './CommentForm';
import { CommentList } from './CommentList';
import styles from './CommentSection.module.css';

/**
 * Comments for one blog post. Gated entirely behind accountsEnabled() — there is no
 * local/offline comment store, since comments are inherently shared, multi-user data; when
 * this deployment has no Supabase project, the section shows a plain notice instead of a
 * form that could not work, matching how Account.tsx already hides itself.
 */
export function CommentSection({ postSlug }: { postSlug: string }) {
  const { status, user, client, ensureClient } = useAuth();
  const { showToast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  /*
    Comments are public, so reading them must work signed out — and supabase-js is no longer
    on first load (lib/supabase.ts). This asks for the client and wires up once it arrives.

    If the component unmounts before it does, `active` is false by then and nothing is
    subscribed; `unsubscribe` stays the no-op, so cleanup is safe in either order.
  */
  useEffect(() => {
    if (!accountsEnabled()) return;
    let active = true;
    let unsubscribe = () => {};
    setLoading(true);

    void ensureClient().then((loaded) => {
      if (!active || !loaded) return;

      listComments(loaded, postSlug)
        .then((rows) => {
          if (active) setComments(rows);
        })
        .catch((err: Error) => {
          if (active) showToast(err.message, 'error');
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      unsubscribe = subscribeToPostComments(loaded, postSlug, (event, row) => {
      setComments((prev) => {
        if (event === 'DELETE') return prev.filter((c) => c.id !== row.id);
        const comment = row as Comment;
        const withoutExisting = prev.filter((c) => c.id !== comment.id);
        // A status transition away from 'visible' still arrives here for every subscriber —
        // only the author should keep seeing their own hidden/removed comment on this page.
        const visibleToMe = comment.status === 'visible' || comment.userId === user?.id;
        if (!visibleToMe) return withoutExisting;
        return [...withoutExisting, comment].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
      });
      });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [postSlug, user?.id, showToast, ensureClient]);

  const submit = useCallback(
    async (body: string) => {
      if (!client || !user) return;
      try {
        // No optimistic add: the realtime subscription above adds the row once it round-trips.
        await postComment(client, user.id, postSlug, body);
      } catch (err) {
        showToast((err as Error).message, 'error');
      }
    },
    [client, postSlug, user, showToast],
  );

  const edit = useCallback(
    async (id: string, body: string) => {
      if (!client || !user) return;
      try {
        await editComment(client, user.id, id, body);
      } catch (err) {
        showToast((err as Error).message, 'error');
      }
    },
    [client, user, showToast],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!client || !user) return;
      try {
        await deleteComment(client, user.id, id);
      } catch (err) {
        showToast((err as Error).message, 'error');
      }
    },
    [client, user, showToast],
  );

  const report = useCallback(
    async (id: string) => {
      if (!client || !user) return;
      try {
        await reportComment(client, user.id, id);
        showToast('Comment reported', 'success');
      } catch (err) {
        showToast((err as Error).message, 'error');
      }
    },
    [client, user, showToast],
  );

  if (!accountsEnabled()) {
    return (
      <section className={styles.section} aria-labelledby="comments-heading">
        <h2 id="comments-heading" className={styles.heading}>
          Comments
        </h2>
        <p className={styles.notice}>Comments require accounts to be configured in this deployment.</p>
      </section>
    );
  }

  const visible = comments.filter((c) => c.status === 'visible' || c.userId === user?.id);

  return (
    <section className={styles.section} aria-labelledby="comments-heading">
      <h2 id="comments-heading" className={styles.heading}>
        Comments
      </h2>

      {loading ? (
        <p className={styles.empty}>Loading…</p>
      ) : (
        <CommentList comments={visible} currentUserId={user?.id ?? null} onEdit={edit} onDelete={remove} onReport={report} />
      )}

      {status === 'signed-in' ? (
        <CommentForm onSubmit={submit} />
      ) : (
        <p className={styles.signInPrompt}>
          <Link to="/account">Sign in</Link> to comment.
        </p>
      )}
    </section>
  );
}
