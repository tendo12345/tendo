/**
 * BM25 ranking, ported 1:1 from the Python skill's `scripts/core.py` (commit 7538cfb).
 *
 * Every constant, tokenisation rule and tie-break here mirrors the source. Changing any
 * of them changes which palette/style/font a query resolves to, so treat this file as
 * frozen unless you are deliberately re-tuning the engine.
 */

export class BM25 {
  private readonly k1: number;
  private readonly b: number;
  private corpus: string[][] = [];
  private docLengths: number[] = [];
  private avgdl = 0;
  private idf: Map<string, number> = new Map();
  private docFreqs: Map<string, number> = new Map();
  private N = 0;

  constructor(k1 = 1.5, b = 0.75) {
    this.k1 = k1;
    this.b = b;
  }

  /** Lowercase, strip punctuation, drop words of 2 characters or fewer. */
  tokenize(text: unknown): string[] {
    // Python: re.sub(r'[^\w\s]', ' ', str(text).lower()).
    // Python's \w is [a-zA-Z0-9_] plus unicode letters/digits under the default str flags,
    // so the JS class below uses the unicode property escapes that match that set.
    const normalized = String(text ?? '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}_\s]/gu, ' ');
    return normalized.split(/\s+/).filter((w) => w.length > 2);
  }

  fit(documents: string[]): void {
    this.corpus = documents.map((doc) => this.tokenize(doc));
    this.N = this.corpus.length;
    if (this.N === 0) return;

    this.docLengths = this.corpus.map((doc) => doc.length);
    this.avgdl = this.docLengths.reduce((a, b) => a + b, 0) / this.N;

    for (const doc of this.corpus) {
      const seen = new Set<string>();
      for (const word of doc) {
        if (!seen.has(word)) {
          this.docFreqs.set(word, (this.docFreqs.get(word) ?? 0) + 1);
          seen.add(word);
        }
      }
    }

    for (const [word, freq] of this.docFreqs) {
      this.idf.set(word, Math.log((this.N - freq + 0.5) / (freq + 0.5) + 1));
    }
  }

  /** Score every document against the query, best first. */
  score(query: string): Array<[number, number]> {
    const queryTokens = this.tokenize(query);
    const scores: Array<[number, number]> = [];

    for (let idx = 0; idx < this.corpus.length; idx++) {
      const doc = this.corpus[idx];
      const docLen = this.docLengths[idx];
      const termFreqs = new Map<string, number>();
      for (const word of doc) {
        termFreqs.set(word, (termFreqs.get(word) ?? 0) + 1);
      }

      let score = 0;
      for (const token of queryTokens) {
        const idf = this.idf.get(token);
        if (idf === undefined) continue;
        const tf = termFreqs.get(token) ?? 0;
        const numerator = tf * (this.k1 + 1);
        const denominator = tf + this.k1 * (1 - this.b + (this.b * docLen) / this.avgdl);
        score += (idf * numerator) / denominator;
      }

      scores.push([idx, score]);
    }

    // Python's sorted() is stable, so equal scores keep CSV row order. Array.prototype.sort
    // is also stable per spec, so a plain descending comparator reproduces the same ranking.
    return scores.sort((a, b) => b[1] - a[1]);
  }
}
