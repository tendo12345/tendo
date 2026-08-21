import type { DesignSystemOutput } from '../../engine/types';
import { ColorCard } from './ColorCard';
import result from './result.module.css';

interface ColorSystemSectionProps {
  output: DesignSystemOutput;
}

interface ColorEntry {
  name: string;
  hex: string;
  usage: string;
  cssVar: string;
}

export function ColorSystemSection({ output }: ColorSystemSectionProps) {
  const { colors } = output;
  const background = colors.background;

  const entries: ColorEntry[] = [
    { name: 'Primary', hex: colors.primary, usage: 'Primary actions, links, active states', cssVar: '--color-primary' },
    { name: 'Secondary', hex: colors.secondary, usage: 'Secondary actions, supporting UI', cssVar: '--color-secondary' },
    { name: 'Accent', hex: colors.accent, usage: 'Highlights, callouts, badges', cssVar: '--color-accent' },
    { name: 'Background', hex: colors.background, usage: 'Page and surface background', cssVar: '--color-background' },
    { name: 'Foreground', hex: colors.foreground, usage: 'Primary text color', cssVar: '--color-foreground' },
  ];

  if (colors.muted) entries.push({ name: 'Muted', hex: colors.muted, usage: 'Subtle backgrounds, disabled states', cssVar: '--color-muted' });
  if (colors.border) entries.push({ name: 'Border', hex: colors.border, usage: 'Dividers, input borders', cssVar: '--color-border' });
  if (colors.destructive)
    entries.push({ name: 'Error', hex: colors.destructive, usage: 'Errors, destructive actions', cssVar: '--color-destructive' });

  return (
    <section id="colors" className={result.section} aria-labelledby="colors-heading">
      <div className={result.sectionHead}>
        <h2 id="colors-heading" className={result.sectionTitle}>
          Color system
        </h2>
      </div>
      {colors.notes && <p className={result.sectionIntro}>{colors.notes}</p>}

      <div className={result.cardGrid}>
        {entries.map((entry) => (
          <ColorCard key={entry.name} {...entry} contrastAgainst={entry.name === 'Background' ? undefined : background} />
        ))}
      </div>
    </section>
  );
}
