import { contrastRatio, formatHsl, formatRgb, hexToHsl, hexToRgb, wcagLevel } from '../../lib/colorMath';
import { CopyButton } from '../ui/CopyButton';
import styles from './ColorCard.module.css';

interface ColorCardProps {
  name: string;
  hex: string;
  usage: string;
  cssVar: string;
  contrastAgainst?: string;
}

export function ColorCard({ name, hex, usage, cssVar, contrastAgainst }: ColorCardProps) {
  const rgb = hexToRgb(hex);
  const hsl = hexToHsl(hex);
  const ratio = contrastAgainst ? contrastRatio(hex, contrastAgainst) : null;

  return (
    <div className={styles.card}>
      <div className={styles.swatch} style={{ background: hex }} />
      <div className={styles.body}>
        <p className={styles.name}>{name}</p>
        <p className={styles.hex}>{hex}</p>
        <p className={styles.usage}>{usage}</p>
        <div className={styles.values}>
          {rgb && <span>{formatRgb(rgb)}</span>}
          {hsl && <span>{formatHsl(hsl)}</span>}
        </div>
        <div className={styles.actions}>
          <CopyButton value={hex} label="Copy HEX" successMessage={`${name} HEX copied`} />
          {rgb && <CopyButton value={formatRgb(rgb)} label="Copy RGB" successMessage={`${name} RGB copied`} />}
          <CopyButton value={`var(${cssVar})`} label="Copy CSS Variable" successMessage={`${name} CSS variable copied`} />
        </div>
        {ratio !== null && (
          <p className={styles.contrast}>
            Contrast vs. background: {ratio}:1 <span className={styles.contrastBadge}>{wcagLevel(ratio)}</span>
          </p>
        )}
      </div>
    </div>
  );
}
