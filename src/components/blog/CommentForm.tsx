import { useState } from 'react';
import styles from './CommentForm.module.css';

export function CommentForm({ onSubmit }: { onSubmit: (body: string) => Promise<void> }) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setBusy(true);
    await onSubmit(trimmed);
    setBusy(false);
    setBody('');
  };

  return (
    <form className={styles.form} onSubmit={(e) => void submit(e)}>
      <label className={styles.label} htmlFor="comment-body">
        Add a comment
      </label>
      <textarea
        id="comment-body"
        className={styles.textarea}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={2000}
        rows={3}
        placeholder="Say something about this post…"
      />
      <button type="submit" className={styles.submit} disabled={busy || !body.trim()}>
        {busy ? 'Posting…' : 'Post comment'}
      </button>
    </form>
  );
}
