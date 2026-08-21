import type { MouseEvent } from 'react';
import { useScrollSpy } from '../../hooks/useScrollSpy';
import type { ResultSection } from '../../types/ui';
import styles from './SectionNav.module.css';

interface SectionNavProps {
  sections: ResultSection[];
}

export function SectionNav({ sections }: SectionNavProps) {
  const ids = sections.map((s) => s.id);
  const activeId = useScrollSpy(ids);

  const handleClick = (e: MouseEvent, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', `#${id}`);
  };

  return (
    <nav className={styles.nav} aria-label="Design system sections">
      <div className={`${styles.inner} container hscroll`}>
        {sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className={`${styles.link} ${section.id === activeId ? styles.active : ''}`}
            aria-current={section.id === activeId ? 'true' : undefined}
            onClick={(e) => handleClick(e, section.id)}
          >
            {section.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
