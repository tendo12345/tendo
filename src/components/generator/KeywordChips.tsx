import { useState, type KeyboardEvent } from 'react';
import { getSuggestedKeywords } from '../../lib/styleKeywords';
import { Chip } from '../ui/Chip';
import { Tooltip } from '../ui/Tooltip';
import styles from './GeneratorForm.module.css';

const SUGGESTED = getSuggestedKeywords();

interface KeywordChipsProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export function KeywordChips({ value, onChange }: KeywordChipsProps) {
  const [draft, setDraft] = useState('');

  const addKeyword = (word: string) => {
    const trimmed = word.trim();
    if (!trimmed) return;
    if (value.some((v) => v.toLowerCase() === trimmed.toLowerCase())) return;
    onChange([...value, trimmed]);
  };

  const removeKeyword = (word: string) => {
    onChange(value.filter((v) => v !== word));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addKeyword(draft);
      setDraft('');
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      removeKeyword(value[value.length - 1]);
    }
  };

  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor="keywords">
          Style keywords <span className={styles.optional}>(optional)</span>
        </label>
        <Tooltip text="Choose words that describe how you want the product to feel. They're searched alongside the product description." />
      </div>
      {value.length > 0 && (
        <div className={styles.selectedRow}>
          {value.map((word) => (
            <Chip key={word} onRemove={() => removeKeyword(word)}>
              {word}
            </Chip>
          ))}
        </div>
      )}
      <input
        id="keywords"
        type="text"
        className={styles.input}
        placeholder="Type a word and press Enter…"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className={styles.chipRow}>
        {SUGGESTED.filter((word) => !value.some((v) => v.toLowerCase() === word.toLowerCase())).map((word) => (
          <Chip key={word} onClick={() => addKeyword(word)}>
            {word}
          </Chip>
        ))}
      </div>
    </div>
  );
}
