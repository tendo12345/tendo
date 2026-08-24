import { Link } from 'react-router-dom';
import { listPosts } from '../lib/blog';
import styles from './Blog.module.css';

export default function BlogPage() {
  const posts = listPosts();

  return (
    <div className={`container ${styles.wrap}`}>
      <h1 className={styles.title}>Blog</h1>

      {posts.length === 0 ? (
        <p className={styles.empty}>Nothing published yet.</p>
      ) : (
        <ul className={styles.list}>
          {posts.map((post) => (
            <li key={post.slug} className={styles.item}>
              <Link to={`/blog/${post.slug}`} className={styles.link}>
                <h2 className={styles.postTitle}>{post.title}</h2>
                <p className={styles.excerpt}>{post.excerpt}</p>
                <time className={styles.date} dateTime={post.date}>
                  {new Date(post.date).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
