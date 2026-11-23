/**
 * Utility per la ricerca tollerante agli errori di battitura.
 * Funzioni pure, senza chiamate di rete.
 */

// Parole troppo comuni per essere utili come ricerca da sole.
const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'and', 'in', 'on', 'to',
  'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una',
  'di', 'da', 'del', 'della', 'dei', 'delle', 'e', 'ed', 'per', 'con',
]);

/** Minuscolo, senza accenti e senza punteggiatura. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function words(text: string): string[] {
  return normalize(text).split(' ').filter(Boolean);
}

/** Distanza di Levenshtein (numero minimo di modifiche tra due stringhe). */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    prev = curr;
  }
  return prev[b.length]!;
}

/** Somiglianza tra 0 (diverse) e 1 (uguali). */
function ratio(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  return max === 0 ? 1 : 1 - levenshtein(a, b) / max;
}

/**
 * Quanto un titolo somiglia al testo cercato, tra 0 e 1.
 * Prende il valore migliore tra:
 * - confronto delle stringhe intere ("braking bad" vs "breaking bad")
 * - confronto parola per parola: ogni parola cercata con la parola più simile del titolo
 *   ("trones" trova "thrones" anche se il titolo ha altre parole)
 */
export function similarity(query: string, title: string): number {
  const q = normalize(query);
  const t = normalize(title);
  if (!q || !t) return 0;
  if (q === t) return 1;

  const whole = ratio(q, t);

  const qWords = words(q).filter((w) => !STOPWORDS.has(w));
  const tWords = words(t);
  if (!qWords.length || !tWords.length) return whole;

  const perWord =
    qWords.reduce((sum, qw) => {
      const best = Math.max(
        ...tWords.map((tw) => {
          const r = ratio(qw, tw);
          // Una parola cercata incompleta ("interst") conta come prefisso del titolo.
          // Bonus moderato: un errore di battitura ("ofice") non deve battere la parola
          // giusta ("office") solo perché è prefisso di un'altra ("oficer").
          if (tw.startsWith(qw) && qw.length >= 3) {
            return Math.max(r, 0.6 + 0.3 * (qw.length / tw.length));
          }
          return r;
        })
      );
      return sum + best;
    }, 0) / qWords.length;

  return Math.max(whole, perWord);
}

/**
 * Ricerche alternative da mandare a TMDB quando il testo esatto trova poco.
 * TMDB cerca per parole e prefissi esatti: "braking bad" non trova nulla,
 * ma "bad" trova Breaking Bad. Per ogni parola significativa generiamo
 * la parola stessa e un suo prefisso (per errori verso la fine della parola).
 */
export function queryVariants(query: string, max = 6): string[] {
  const variants: string[] = [];
  const add = (v: string) => {
    if (v.length >= 3 && v !== normalize(query) && !variants.includes(v)) variants.push(v);
  };

  const significant = words(query).filter((w) => !STOPWORDS.has(w) && w.length >= 3);
  // Prima le parole più lunghe: sono le più specifiche
  const sorted = [...significant].sort((a, b) => b.length - a.length);

  for (const w of sorted) add(w);
  // Due prefissi per parola: uno lungo (errore nelle ultime lettere, "titanc" -> "titan")
  // e uno corto (errore più a metà parola, "braking" -> "brak")
  for (const ratioLength of [0.8, 0.6]) {
    for (const w of sorted) {
      const prefixLength = Math.max(4, Math.ceil(w.length * ratioLength));
      if (prefixLength < w.length) add(w.slice(0, prefixLength));
    }
  }

  return variants.slice(0, max);
}
