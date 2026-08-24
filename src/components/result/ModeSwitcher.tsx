import type { ModePalette } from '../../engine/darkMode';
import styles from './ModeSwitcher.module.css';

interface ModeSwitcherProps {
  modes: ModePalette[];
  activeIndex: number;
  onChange: (index: number) => void;
}

/** Light/dark toggle, shared by anything showing a mode-dependent preview of the palette. */
export function ModeSwitcher({ modes, activeIndex, onChange }: ModeSwitcherProps) {
  return (
    <div className={styles.switcher} role="group" aria-label="Colour mode">
      {modes.map((m, i) => (
        <button
          key={m.mode}
          type="button"
          className={`${styles.switchButton} ${i === activeIndex ? styles.switchActive : ''}`}
          aria-pressed={i === activeIndex}
          onClick={() => onChange(i)}
        >
          {m.mode === 'light' ? 'Light' : 'Dark'}
          <span className={styles.originTag}>{m.isGenerated ? 'Generated' : 'Derived'}</span>
        </button>
      ))}
    </div>
  );
}
