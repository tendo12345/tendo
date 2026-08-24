/**
 * Comments against a stubbed Supabase client — same technique as remoteSystemStore.test.ts.
 * No network, no live project: this tests the contract (payload shape, which id gets trusted,
 * how errors surface), not Postgres behavior. RLS, the auto-hide trigger, and realtime
 * delivery are verified against a real project — see DEPLOY.md.
 */

import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  deleteComment,
  editComment,
  listComments,
  listModerationQueue,
  moderateComment,
  postComment,
  reportComment,
  subscribeToPostComments,
} from './comments';

const COMMENT_ROW = {
  id: 'c1',
  post_slug: 'naming-tokens',
  user_id: 'user-1',
  body: 'Nice post.',
  status: 'visible',
  report_count: 0,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const PROFILE_ROW = { id: 'user-1', display_name: 'user-abcdef12' };

function stubClient(overrides: {
  comments?: Record<string, unknown>;
  profiles?: Record<string, unknown>;
  reports?: Record<string, unknown>;
} = {}) {
  const captured: Record<string, unknown> = {};

  const profilesBuilder: Record<string, unknown> = {
    select: vi.fn(() => profilesBuilder),
    in: vi.fn((_col: string, vals: unknown) => {
      captured['profiles.in'] = vals;
      return Promise.resolve({ data: [PROFILE_ROW], error: null });
    }),
    ...overrides.profiles,
  };

  const commentsBuilder: Record<string, unknown> = {
    select: vi.fn(() => commentsBuilder),
    order: vi.fn(() => Promise.resolve({ data: [COMMENT_ROW], error: null })),
    eq: vi.fn((col: string, val: unknown) => {
      captured[`eq:${col}`] = val;
      return commentsBuilder;
    }),
    neq: vi.fn((col: string, val: unknown) => {
      captured[`neq:${col}`] = val;
      return commentsBuilder;
    }),
    single: vi.fn(() => Promise.resolve({ data: COMMENT_ROW, error: null })),
    insert: vi.fn((payload: unknown) => {
      captured.insert = payload;
      return commentsBuilder;
    }),
    update: vi.fn((payload: unknown) => {
      captured.update = payload;
      return commentsBuilder;
    }),
    delete: vi.fn(() => {
      captured.deleted = true;
      return commentsBuilder;
    }),
    ...overrides.comments,
  };

  const reportsBuilder: Record<string, unknown> = {
    insert: vi.fn((payload: unknown) => {
      captured.reportInsert = payload;
      return Promise.resolve({ data: null, error: null });
    }),
    ...overrides.reports,
  };

  const client = {
    from: vi.fn((table: string) => {
      if (table === 'profiles') return profilesBuilder;
      if (table === 'comment_reports') return reportsBuilder;
      return commentsBuilder;
    }),
  } as unknown as SupabaseClient;

  return { client, captured, commentsBuilder, profilesBuilder, reportsBuilder };
}

describe('listComments', () => {
  it('filters by post_slug and resolves author display names', async () => {
    const { client, captured } = stubClient();

    const comments = await listComments(client, 'naming-tokens');

    expect(captured['eq:post_slug']).toBe('naming-tokens');
    expect(captured['profiles.in']).toEqual(['user-1']);
    expect(comments[0]).toEqual({
      id: 'c1',
      postSlug: 'naming-tokens',
      userId: 'user-1',
      authorName: 'user-abcdef12',
      body: 'Nice post.',
      status: 'visible',
      reportCount: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('throws on a database error instead of returning nothing', async () => {
    const { client } = stubClient({
      comments: { order: vi.fn(() => Promise.resolve({ data: null, error: { message: 'permission denied' } })) },
    });
    await expect(listComments(client, 'naming-tokens')).rejects.toThrow('permission denied');
  });
});

describe('postComment', () => {
  it('sets user_id from the passed-in id, not the caller', async () => {
    const { client, captured } = stubClient();
    await postComment(client, 'user-1', 'naming-tokens', '  Great read.  ');
    expect(captured.insert).toEqual({ user_id: 'user-1', post_slug: 'naming-tokens', body: 'Great read.' });
  });

  it('rejects an empty body without hitting the network', async () => {
    const { client } = stubClient();
    await expect(postComment(client, 'user-1', 'naming-tokens', '   ')).rejects.toThrow('empty');
  });
});

describe('editComment / deleteComment', () => {
  it('scopes the update to both the comment id and the caller', async () => {
    const { client, captured } = stubClient();
    await editComment(client, 'user-1', 'c1', 'updated body');
    expect(captured.update).toEqual({ body: 'updated body' });
    expect(captured['eq:id']).toBe('c1');
    expect(captured['eq:user_id']).toBe('user-1');
  });

  it('ignores a blank edit rather than wiping the body', async () => {
    const { client, captured } = stubClient();
    await editComment(client, 'user-1', 'c1', '   ');
    expect(captured.update).toBeUndefined();
  });

  it('scopes delete to both the comment id and the caller', async () => {
    const { client, captured } = stubClient();
    await deleteComment(client, 'user-1', 'c1');
    expect(captured.deleted).toBe(true);
    expect(captured['eq:id']).toBe('c1');
    expect(captured['eq:user_id']).toBe('user-1');
  });
});

describe('reportComment', () => {
  it('surfaces a duplicate report distinctly from a generic failure', async () => {
    const { client } = stubClient({
      reports: {
        insert: vi.fn(() =>
          Promise.resolve({ data: null, error: { code: '23505', message: 'duplicate key value' } }),
        ),
      },
    });
    await expect(reportComment(client, 'user-1', 'c1')).rejects.toThrow('already reported');
  });

  it('surfaces any other failure with its own message', async () => {
    const { client } = stubClient({
      reports: { insert: vi.fn(() => Promise.resolve({ data: null, error: { code: '42501', message: 'permission denied' } })) },
    });
    await expect(reportComment(client, 'user-1', 'c1')).rejects.toThrow('permission denied');
  });
});

describe('moderation queue', () => {
  it('lists only non-visible comments', async () => {
    const { client, captured } = stubClient();
    await listModerationQueue(client);
    expect(captured['neq:status']).toBe('visible');
  });

  it('approve sets status back to visible', async () => {
    const { client, captured } = stubClient();
    await moderateComment(client, 'c1', 'approve');
    expect(captured.update).toEqual({ status: 'visible' });
  });

  it('remove sets status to removed, not a delete', async () => {
    const { client, captured } = stubClient();
    await moderateComment(client, 'c1', 'remove');
    expect(captured.update).toEqual({ status: 'removed' });
    expect(captured.deleted).toBeUndefined();
  });
});

describe('subscribeToPostComments', () => {
  function stubChannel() {
    type Handler = (payload: unknown) => void;
    const handlers: { config: { filter: string; table: string }; cb: Handler }[] = [];
    const channel = {
      on: vi.fn((_type: string, config: { filter: string; table: string }, cb: Handler) => {
        handlers.push({ config, cb });
        return channel;
      }),
      subscribe: vi.fn(() => channel),
    };
    return { channel, handlers };
  }

  it('subscribes with a filter scoped to the post and tears down via removeChannel', () => {
    const { client } = stubClient();
    const { channel, handlers } = stubChannel();
    (client as unknown as { channel: unknown }).channel = vi.fn(() => channel);
    (client as unknown as { removeChannel: unknown }).removeChannel = vi.fn();

    const unsubscribe = subscribeToPostComments(client, 'naming-tokens', vi.fn());

    expect((client as unknown as { channel: ReturnType<typeof vi.fn> }).channel).toHaveBeenCalledWith(
      'comments:naming-tokens',
    );
    expect(handlers[0].config).toMatchObject({ table: 'comments', filter: 'post_slug=eq.naming-tokens' });

    unsubscribe();
    expect((client as unknown as { removeChannel: ReturnType<typeof vi.fn> }).removeChannel).toHaveBeenCalledWith(
      channel,
    );
  });

  it('resolves an INSERT payload into a full Comment before calling back', async () => {
    const { client } = stubClient();
    const { channel, handlers } = stubChannel();
    (client as unknown as { channel: unknown }).channel = vi.fn(() => channel);
    (client as unknown as { removeChannel: unknown }).removeChannel = vi.fn();

    const onChange = vi.fn();
    subscribeToPostComments(client, 'naming-tokens', onChange);

    await handlers[0].cb({ eventType: 'INSERT', new: COMMENT_ROW, old: {} });
    await Promise.resolve();

    expect(onChange).toHaveBeenCalledWith(
      'INSERT',
      expect.objectContaining({ id: 'c1', authorName: 'user-abcdef12' }),
    );
  });

  it('passes a DELETE payload through as just an id', async () => {
    const { client } = stubClient();
    const { channel, handlers } = stubChannel();
    (client as unknown as { channel: unknown }).channel = vi.fn(() => channel);
    (client as unknown as { removeChannel: unknown }).removeChannel = vi.fn();

    const onChange = vi.fn();
    subscribeToPostComments(client, 'naming-tokens', onChange);

    await handlers[0].cb({ eventType: 'DELETE', new: {}, old: { id: 'c1' } });

    expect(onChange).toHaveBeenCalledWith('DELETE', { id: 'c1' });
  });
});
