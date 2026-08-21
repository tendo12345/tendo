import { useMemo, useState } from 'react';
import type { DesignSystemOutput } from '../../engine/types';
import { downloadFile } from '../../lib/clipboard';
import { toCssVariables, toDesignTokensJson, toJson, toMarkdown, toTailwindConfig } from '../../lib/exportFormatters';
import { Button } from '../ui/Button';
import { CopyButton } from '../ui/CopyButton';
import { Tabs } from '../ui/Tabs';
import result from './result.module.css';
import styles from './ExportSection.module.css';

interface ExportSectionProps {
  output: DesignSystemOutput;
}

const FORMATS = [
  { id: 'css', label: 'CSS Variables', ext: 'css', mime: 'text/css' },
  { id: 'json', label: 'JSON', ext: 'json', mime: 'application/json' },
  { id: 'tailwind', label: 'Tailwind Config', ext: 'js', mime: 'text/javascript' },
  { id: 'tokens', label: 'Design Tokens', ext: 'json', mime: 'application/json' },
  { id: 'markdown', label: 'Markdown Docs', ext: 'md', mime: 'text/markdown' },
] as const;

type FormatId = (typeof FORMATS)[number]['id'];

function formatContent(id: FormatId, output: DesignSystemOutput): string {
  switch (id) {
    case 'css':
      return toCssVariables(output);
    case 'json':
      return toJson(output);
    case 'tailwind':
      return toTailwindConfig(output);
    case 'tokens':
      return toDesignTokensJson(output);
    case 'markdown':
      return toMarkdown(output);
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'design-system';
}

export function ExportSection({ output }: ExportSectionProps) {
  const [formatId, setFormatId] = useState<FormatId>('css');
  const format = FORMATS.find((f) => f.id === formatId)!;
  const content = useMemo(() => formatContent(formatId, output), [formatId, output]);
  const filename = `${slugify(output.category)}.${format.ext}`;

  return (
    <section id="export" className={result.section} aria-labelledby="export-heading">
      <h2 id="export-heading" className={result.sectionTitleSpaced}>
        Export
      </h2>
      <p className={result.sectionIntro}>Every format below is generated from this exact result — nothing is re-fetched or recomputed.</p>

      <div className={styles.toolbar}>
        <Tabs items={FORMATS.map((f) => ({ id: f.id, label: f.label }))} activeId={formatId} onChange={(id) => setFormatId(id as FormatId)} label="Export format" />
        <div className={styles.actions}>
          <CopyButton value={content} label="Copy" successMessage={`${format.label} copied`} />
          <Button size="sm" variant="secondary" onClick={() => downloadFile(filename, content, format.mime)}>
            Download
          </Button>
        </div>
      </div>

      <div className={styles.codeWrap}>
        <pre className={styles.code}>
          <code>{content}</code>
        </pre>
      </div>
    </section>
  );
}
