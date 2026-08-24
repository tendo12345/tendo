import { Link, useParams } from 'react-router-dom';
import { getPost } from '../lib/blog';
import { CommentSection } from '../components/blog/CommentSection';
import styles from './BlogPost.module.css';

export default function BlogPostPage() {
  const { slug = '' } = useParams();
  const post = getPost(slug);

  if (!post) {
    return (
      <div className={`container ${styles.wrap}`}>
        <h1 className={styles.title}>This post doesn&rsquo;t exist.</h1>
        <Link className={styles.back} to="/blog">
          Back to the blog
        </Link>
      </div>
    );
  }

  return (
    <div className={`container ${styles.wrap}`}>
      <Link className={styles.back} to="/blog">
        Back to the blog
      </Link>
      <h1 className={styles.title}>{post.title}</h1>
      <time className={styles.date} dateTime={post.date}>
        {new Date(post.date).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </time>
      {/* Trusted, repo-authored Markdown rendered to HTML at load time — see src/lib/blog.ts.
          Never do this with comment bodies. */}
      <div className={styles.body} dangerouslySetInnerHTML={{ __html: post.html }} />

      <CommentSection postSlug={post.slug} />
    </div>
  );
}
