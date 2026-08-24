import type { RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js';

/**
 * Blog comments: CRUD, reporting, moderation, and the realtime subscription behind them.
 *
 * Same shape as remoteSystemStore.ts on purpose: the client is passed in explicitly rather
 * than imported as a singleton, and every query filters on the caller's own id in addition to
 * what RLS already guarantees (see supabase/schema.sql) — belt-and-braces against a table
 * that lost its policies after a re-run migration, not a substitute for RLS.
 *
 * Comment bodies are plain text end to end. They are never parsed as Markdown/HTML (unlike
 * blog post bodies — see src/lib/blog.ts) and must always render via textContent/React text
 * nodes, never dangerouslySetInnerHTML. That boundary is enforced in
 * src/components/blog/CommentItem.tsx, not here, but it starts here: this file never HTML-
 * escapes or transforms `body` — it passes it through untouched.
 */

export type CommentStatus = 'visible' | 'pending_review' | 'removed';

export interface Comment {
  id: string;
  postSlug: string;
  userId: string;
  /** From profiles.display_name — never the user's email. */
  authorName: string;
  body: string;
  status: CommentStatus;
  reportCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Row {
  id: string;
  post_slug: string;
  user_id: string;
  body: string;
  status: CommentStatus;
  report_count: number;
  created_at: string;
  updated_at: string;
}

const COMMENT_COLUMNS = 'id, post_slug, user_id, body, status, report_count, created_at, updated_at';

function toComment(row: Row, authorName: string): Comment {
  return {
    id: row.id,
    postSlug: row.post_slug,
    userId: row.user_id,
    authorName,
    body: row.body,
    status: row.status,
    reportCount: row.report_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Author names come from an RPC, not a table read.
 *
 * `profiles` has no broad select policy: granting one would expose the whole row, `role`
 * included, because RLS cannot restrict by column. Selecting only `display_name` here would
 * have looked identical while leaving anyone with the anon key free to `select *` and
 * enumerate admins. The function returns two columns and nothing else — see schema.sql.
 */
async function resolveAuthorNames(client: SupabaseClient, userIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return new Map();

  const { data, error } = await client.rpc('comment_author_names', { ids: unique });
  if (error) throw new Error(error.message);

  return new Map((data as { id: string; display_name: string }[]).map((r) => [r.id, r.display_name]));
}

async function toComments(client: SupabaseClient, rows: Row[]): Promise<Comment[]> {
  const names = await resolveAuthorNames(
    client,
    rows.map((r) => r.user_id),
  );
  return rows.map((r) => toComment(r, names.get(r.user_id) ?? 'Unknown'));
}

/** Oldest first — the natural reading order for a comment thread. */
export async function listComments(client: SupabaseClient, postSlug: string): Promise<Comment[]> {
  const { data, error } = await client
    .from('comments')
    .select(COMMENT_COLUMNS)
    .eq('post_slug', postSlug)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return toComments(client, data as Row[]);
}

export async function postComment(
  client: SupabaseClient,
  userId: string,
  postSlug: string,
  body: string,
): Promise<Comment> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Comment cannot be empty.');

  const { data, error } = await client
    .from('comments')
    .insert({ user_id: userId, post_slug: postSlug, body: trimmed })
    .select(COMMENT_COLUMNS)
    .single();
  if (error) throw new Error(error.message);

  const names = await resolveAuthorNames(client, [userId]);
  return toComment(data as Row, names.get(userId) ?? 'Unknown');
}

export async function editComment(
  client: SupabaseClient,
  userId: string,
  commentId: string,
  body: string,
): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) return;
  const { error } = await client
    .from('comments')
    .update({ body: trimmed })
    .eq('id', commentId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function deleteComment(client: SupabaseClient, userId: string, commentId: string): Promise<void> {
  const { error } = await client.from('comments').delete().eq('id', commentId).eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function reportComment(
  client: SupabaseClient,
  reporterId: string,
  commentId: string,
  reason?: string,
): Promise<void> {
  const { error } = await client
    .from('comment_reports')
    .insert({ comment_id: commentId, reporter_id: reporterId, reason: reason ?? null });
  if (error) {
    // 23505 = unique_violation: this reporter already reported this comment.
    if (error.code === '23505') throw new Error('You already reported this comment.');
    throw new Error(error.message);
  }
}

export type CommentChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

/**
 * Live updates for one post's comments. Returns an unsubscribe function.
 *
 * RLS applies to postgres_changes payloads, but a status transition to pending_review still
 * arrives as an UPDATE to every subscriber who has that row cached — including everyone but
 * its author and admins, who must no longer see it. Callers are responsible for re-filtering
 * on `status` after each event, the same belt-and-braces reasoning this file uses everywhere
 * else for RLS.
 */
export function subscribeToPostComments(
  client: SupabaseClient,
  postSlug: string,
  onChange: (event: CommentChangeEvent, comment: Comment | { id: string }) => void,
): () => void {
  const channel = client
    .channel(`comments:${postSlug}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'comments', filter: `post_slug=eq.${postSlug}` },
      (payload: RealtimePostgresChangesPayload<Row>) => {
        void handlePayload(client, payload, onChange);
      },
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}

async function handlePayload(
  client: SupabaseClient,
  payload: RealtimePostgresChangesPayload<Row>,
  onChange: (event: CommentChangeEvent, comment: Comment | { id: string }) => void,
): Promise<void> {
  if (payload.eventType === 'DELETE') {
    const old = payload.old as { id?: string };
    if (old.id) onChange('DELETE', { id: old.id });
    return;
  }

  const row = payload.new as Row;
  const names = await resolveAuthorNames(client, [row.user_id]);
  onChange(payload.eventType, toComment(row, names.get(row.user_id) ?? 'Unknown'));
}

// --- Admin moderation. RLS enforces these server-side regardless of what the client sends. ---

/** Reported/pending comments, newest first — the moderation queue. */
export async function listModerationQueue(client: SupabaseClient): Promise<Comment[]> {
  const { data, error } = await client
    .from('comments')
    .select(COMMENT_COLUMNS)
    .neq('status', 'visible')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return toComments(client, data as Row[]);
}

export async function moderateComment(
  client: SupabaseClient,
  commentId: string,
  action: 'approve' | 'remove',
): Promise<void> {
  const { error } = await client
    .from('comments')
    .update({ status: action === 'approve' ? 'visible' : 'removed' })
    .eq('id', commentId);
  if (error) throw new Error(error.message);
}
