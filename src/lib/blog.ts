import { marked } from 'marked';

/**
 * Blog posts, authored as Markdown files under src/content/blog.
 *
 * No CMS, no admin UI for posts — a post is a file in the repo, same spirit as the ported
 * datasets under src/data being files rather than a database. Frontmatter is a fixed, flat
 * key set (title/slug/date/excerpt), so it is hand-parsed rather than pulling in a YAML
 * library that exists to handle nesting this content never uses.
 *
 * Rendering the body through `marked` and injecting the result via `dangerouslySetInnerHTML`
 * is safe ONLY because post bodies are trusted, repo-authored files, not user input. Comment
 * bodies (src/lib/comments.ts, src/components/blog/CommentItem.tsx) must never take this
 * path — they render as plain text.
 */

export interface BlogPostMeta {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
}

export interface BlogPost extends BlogPostMeta {
  html: string;
}

const REQUIRED_FIELDS = ['title', 'slug', 'date', 'excerpt'] as const;

export function parseFrontmatter(raw: string): { meta: BlogPostMeta; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
  if (!match) {
    throw new Error('Post is missing a --- frontmatter block.');
  }

  const [, frontmatter, body] = match;
  const fields: Record<string, string> = {};
  for (const line of frontmatter.split('\n')) {
    if (!line.trim()) continue;
    const separator = line.indexOf(':');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    fields[key] = value;
  }

  for (const field of REQUIRED_FIELDS) {
    if (!fields[field]) {
      throw new Error(`Post frontmatter is missing "${field}".`);
    }
  }

  return {
    meta: {
      title: fields.title,
      slug: fields.slug,
      date: fields.date,
      excerpt: fields.excerpt,
    },
    body: body.trim(),
  };
}

const rawFiles = import.meta.glob('/src/content/blog/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const posts: BlogPost[] = Object.values(rawFiles)
  .map((raw) => {
    const { meta, body } = parseFrontmatter(raw);
    return { ...meta, html: marked.parse(body, { async: false }) };
  })
  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

const bySlug = new Map(posts.map((p) => [p.slug, p]));
if (bySlug.size !== posts.length) {
  // Not fatal — the dev should notice the duplicate URL, but a colliding slug should not
  // take the whole blog down.
  console.warn('[blog] two posts share a slug; one will shadow the other.');
}

/** Newest first. */
export function listPosts(): BlogPostMeta[] {
  return posts.map(({ slug, title, date, excerpt }) => ({ slug, title, date, excerpt }));
}

export function getPost(slug: string): BlogPost | null {
  return bySlug.get(slug) ?? null;
}
