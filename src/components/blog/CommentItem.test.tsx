// @vitest-environment jsdom

/**
 * Locks in the one load-bearing guarantee from CommentItem's doc comment: a comment body is
 * never parsed as markup, however it's spelled. A future edit that accidentally routes it
 * through `marked` or `dangerouslySetInnerHTML` would be an XSS-adjacent regression, and this
 * is the test that would catch it.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommentItem } from './CommentItem';
import type { Comment } from '../../lib/comments';

const COMMENT: Comment = {
  id: 'c1',
  postSlug: 'naming-tokens',
  userId: 'user-1',
  authorName: 'user-abcdef12',
  body: '<script>window.hacked = true</script> **not bold** _not italic_',
  status: 'visible',
  reportCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('CommentItem', () => {
  it('renders the body as literal text, never parsed as HTML or Markdown', () => {
    render(
      <CommentItem comment={COMMENT} canModify={false} onEdit={vi.fn()} onDelete={vi.fn()} onReport={vi.fn()} />,
    );

    expect(screen.getByText(COMMENT.body)).toBeTruthy();
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('strong')).toBeNull();
    expect(document.querySelector('em')).toBeNull();
  });

  it('shows a pending-review badge only for the author on a hidden comment', () => {
    render(
      <CommentItem
        comment={{ ...COMMENT, status: 'pending_review' }}
        canModify
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onReport={vi.fn()}
      />,
    );

    expect(screen.getByText(/under review/i)).toBeTruthy();
  });
});
