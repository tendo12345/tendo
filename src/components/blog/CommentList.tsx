import type { Comment } from '../../lib/comments';
import { CommentItem } from './CommentItem';
import styles from './CommentSection.module.css';

interface CommentListProps {
  comments: Comment[];
  currentUserId: string | null;
  onEdit: (id: string, body: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReport: (id: string) => Promise<void>;
}

export function CommentList({ comments, currentUserId, onEdit, onDelete, onReport }: CommentListProps) {
  if (comments.length === 0) {
    return <p className={styles.empty}>No comments yet.</p>;
  }

  return (
    <ul className={styles.list}>
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          canModify={comment.userId === currentUserId}
          onEdit={(body) => onEdit(comment.id, body)}
          onDelete={() => onDelete(comment.id)}
          onReport={() => onReport(comment.id)}
        />
      ))}
    </ul>
  );
}
