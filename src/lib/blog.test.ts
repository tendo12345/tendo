import { describe, expect, it } from 'vitest';
import { getPost, listPosts, parseFrontmatter } from './blog';

describe('parseFrontmatter', () => {
  it('splits a valid post into meta and body', () => {
    const raw = [
      '---',
      'title: A title',
      'slug: a-slug',
      'date: 2026-01-01',
      'excerpt: An excerpt.',
      '---',
      '',
      'Body text.',
    ].join('\n');

    const { meta, body } = parseFrontmatter(raw);

    expect(meta).toEqual({
      title: 'A title',
      slug: 'a-slug',
      date: '2026-01-01',
      excerpt: 'An excerpt.',
    });
    expect(body).toBe('Body text.');
  });

  it('throws when the frontmatter delimiter is missing', () => {
    expect(() => parseFrontmatter('title: no fence\n\nBody.')).toThrow(/frontmatter block/);
  });

  it('throws when a required field is missing', () => {
    const raw = ['---', 'title: A title', 'slug: a-slug', '---', 'Body.'].join('\n');
    expect(() => parseFrontmatter(raw)).toThrow(/"date"/);
  });
});

describe('listPosts / getPost', () => {
  it('lists the checked-in posts newest first', () => {
    const posts = listPosts();
    expect(posts.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < posts.length; i++) {
      expect(posts[i - 1].date >= posts[i].date).toBe(true);
    }
  });

  it('returns each post with its frontmatter and no html field', () => {
    const [first] = listPosts();
    expect(first).not.toHaveProperty('html');
    expect(first.slug).toBeTruthy();
  });

  it('gets a post by slug with rendered html', () => {
    const [first] = listPosts();
    const post = getPost(first.slug);
    expect(post?.title).toBe(first.title);
    expect(post?.html).toContain('<p>');
  });

  it('returns null for an unknown slug', () => {
    expect(getPost('does-not-exist')).toBeNull();
  });
});
