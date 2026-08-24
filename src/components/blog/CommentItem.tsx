import { useState } from 'react';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import type { Comment } from '../../lib/comments';
import styles from './CommentItem.module.css';

interface CommentItemProps {
  comment: Comment;
  canModify: boolean;
  onEdit: (body: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onReport: () => Promise<void>;
}

/**
 * `comment.body` renders as plain text ONLY — never dangerouslySetInnerHTML, never through
 * `marked`. Unlike a blog post's body (trusted, repo-authored), this is user input, and this
 * is the one place it reaches the DOM. `white-space: pre-wrap` preserves line breaks without
 * interpreting anything else as markup.
 */
export function CommentItem({ comment, canModify, onEdit, onDelete, onReport }: CommentItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [busy, setBusy] = useState(false);

  const pending = comment.status === 'pending_review';

  const saveEdit = async () => {
    setBusy(true);
    await onEdit(draft);
    setBusy(false);
    setEditing(false);
  };

  return (
    <li className={styles.item}>
      <Avatar email={comment.authorName} size="sm" />
      <div className={styles.body}>
        <div className={styles.head}>
          <span className={styles.author}>{comment.authorName}</span>
          <time className={styles.time} dateTime={comment.createdAt}>
            {new Date(comment.createdAt).toLocaleString()}
          </time>
          {pending && <Badge tone="negative">Under review — only visible to you</Badge>}
        </div>

        {editing ? (
          <div className={styles.editForm}>
            <textarea
              className={styles.textarea}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={2000}
              rows={3}
            />
            <div className={styles.actions}>
              <button type="button" className={styles.action} onClick={() => void saveEdit()} disabled={busy || !draft.trim()}>
                {busy ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                className={styles.action}
                onClick={() => {
                  setDraft(comment.body);
                  setEditing(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className={styles.text}>{comment.body}</p>
            <div className={styles.actions}>
              {canModify ? (
                <>
                  <button type="button" className={styles.action} onClick={() => setEditing(true)}>
                    Edit
                  </button>
                  <button type="button" className={styles.action} onClick={() => void onDelete()}>
                    Delete
                  </button>
                </>
              ) : (
                <button type="button" className={styles.action} onClick={() => void onReport()}>
                  Report
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </li>
  );
}
