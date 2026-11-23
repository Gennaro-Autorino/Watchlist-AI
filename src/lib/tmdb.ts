import { MediaDetails, MediaItem, MediaType, TMDBSearchResponse } from '@/types/tmdb';
import { queryVariants, similarity } from '@/lib/fuzzy';
import { suggestTitles } from '@/lib/ai';

const BASE_URL = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const API_KEY = process.env.TMDB_API_KEY;

function getApiKey(): string {
  if (!API_KEY) {
    throw new Error('TMDB_API_KEY non trovata nelle variabili d’ambiente');
  }
  return API_KEY;
}

/** Una chiamata a /search/multi di TMDB (prima pagina). */
async function searchMulti(query: string): Promise<TMDBSearchResponse> {
  const url = `${BASE_URL}/search/multi?api_key=${getApiKey()}&query=${encodeURIComponent(
    query
  )}&language=it-IT&include_adult=false`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Errore API TMDB: ${response.statusText}`);
  }

  return response.json();
}

export interface SearchResult {
  results: MediaItem[];
  /** true se il testo esatto non ha trovato nulla di simile e mostriamo titoli simili */
  fuzzy: boolean;
  /** Titolo suggerito dall'AI ("Forse cercavi..."), se è stata usata */
  suggestion?: string;
}

// Soglie di somiglianza (0..1, vedi lib/fuzzy.ts)
const GOOD_MATCH = 0.75; // risultato che corrisponde bene al testo cercato
const MIN_FUZZY_MATCH = 0.6; // sotto questa soglia un risultato alternativo viene scartato
// Sopra questa soglia la ricerca tollerante basta e l'AI non viene chiamata.
// Più alta di GOOD_MATCH: "titanc" somiglia a "Titan" (0,83) ma intendeva "Titanic".
const SKIP_AI_MATCH = 0.9;
const MAX_RESULTS = 20;

const mediaKeyOf = (item: MediaItem) => `${item.media_type}:${item.id}`;

function isMovieOrTv(item: MediaItem): boolean {
  return item.media_type === 'movie' || item.media_type === 'tv';
}

/** Somiglianza migliore tra il testo cercato e i titoli (italiano e originale) del media. */
function bestSimilarity(query: string, item: MediaItem): number {
  const titles = [item.title, item.name, item.original_title, item.original_name].filter(
    (t): t is string => Boolean(t)
  );
  return Math.max(0, ...titles.map((t) => similarity(query, t)));
}

/**
 * Ricerca tollerante agli errori di battitura.
 *
 * 1. Cerca il testo esatto. Se trova abbastanza titoli simili al testo, usa quelli
 *    (l'ordine di TMDB è già buono).
 * 2. Altrimenti cerca anche le singole parole e i loro prefissi (vedi queryVariants),
 *    unisce i risultati e li ordina per somiglianza con il testo scritto.
 *    Esempio: "braking bad" -> cerca anche "braking", "bad", "brak" -> trova "Breaking Bad".
 * 3. Se ancora nulla somiglia al testo, chiede a Gemini il titolo corretto (vedi lib/ai.ts).
 */
export async function searchMedia(query: string): Promise<SearchResult> {
  const exact = (await searchMulti(query)).results.filter(isMovieOrTv);
  const goodExact = exact.filter((item) => bestSimilarity(query, item) >= GOOD_MATCH);

  if (goodExact.length >= 3) {
    return { results: exact, fuzzy: false };
  }

  const variants = queryVariants(query);
  // Se una variante fallisce, le altre bastano: non blocca tutta la ricerca
  const responses = await Promise.allSettled(variants.map((v) => searchMulti(v)));

  const byKey = new Map<string, MediaItem>();
  for (const item of exact) byKey.set(mediaKeyOf(item), item);
  for (const res of responses) {
    if (res.status !== 'fulfilled') continue;
    for (const item of res.value.results.filter(isMovieOrTv)) {
      const key = mediaKeyOf(item);
      if (!byKey.has(key)) byKey.set(key, item);
    }
  }

  const exactKeys = new Set(exact.map(mediaKeyOf));

  const scored = [...byKey.entries()]
    .map(([key, item]) => {
      const sim = bestSimilarity(query, item);
      // A parità di somiglianza vince il titolo più popolare
      const popularityBonus = Math.min(0.1, Math.log10(1 + (item.popularity ?? 0)) / 40);
      return { key, item, sim, score: sim + popularityBonus };
    })
    // I risultati della ricerca esatta restano sempre; quelli alternativi solo se simili
    .filter(({ key, sim }) => exactKeys.has(key) || sim >= MIN_FUZZY_MATCH)
    .sort((a, b) => b.score - a.score);

  const ranked = scored.map(({ item }) => item);

  // 3. Nessun risultato somiglia quasi del tutto al testo: chiede all'AI cosa intendeva
  //    l'utente (es. "avngers" -> "Avengers"). Solo in questo caso, per limitare le chiamate.
  if (!scored.some(({ sim }) => sim >= SKIP_AI_MATCH)) {
    const ai = await searchAiSuggestions(query);
    if (ai.results.length > 0) {
      const aiKeys = new Set(ai.results.map(mediaKeyOf));
      return {
        results: [...ai.results, ...ranked.filter((item) => !aiKeys.has(mediaKeyOf(item)))].slice(
          0,
          MAX_RESULTS
        ),
        fuzzy: true,
        suggestion: ai.suggestion,
      };
    }
  }

  return {
    results: ranked.slice(0, MAX_RESULTS),
    fuzzy: goodExact.length === 0 && ranked.length > 0,
  };
}

/**
 * Cerca su TMDB i titoli suggeriti dall'AI.
 * Tiene solo i risultati che somigliano davvero al titolo suggerito,
 * nell'ordine dei suggerimenti (il primo è il più probabile).
 */
async function searchAiSuggestions(
  query: string
): Promise<{ results: MediaItem[]; suggestion?: string }> {
  const suggestions = await suggestTitles(query);
  if (suggestions.length === 0) return { results: [] };

  const responses = await Promise.allSettled(suggestions.map((s) => searchMulti(s)));

  const results: MediaItem[] = [];
  const seen = new Set<string>();
  let suggestion: string | undefined;

  responses.forEach((res, i) => {
    if (res.status !== 'fulfilled') return;
    const title = suggestions[i]!;
    const matches = res.value.results
      .filter(isMovieOrTv)
      .filter((item) => bestSimilarity(title, item) >= GOOD_MATCH);
    if (matches.length > 0) suggestion ??= title;
    for (const item of matches) {
      const key = mediaKeyOf(item);
      if (!seen.has(key)) {
        seen.add(key);
        results.push(item);
      }
    }
  });

  return { results, suggestion };
}

/**
 * Recupera i dati ufficiali di un film o di una serie da TMDB.
 * Usato lato server per non fidarsi dei dati inviati dal client.
 * Restituisce null se il titolo non esiste.
 */
export async function getMediaDetails(
  tmdbId: number,
  mediaType: MediaType
): Promise<MediaDetails | null> {
  const url = `${BASE_URL}/${mediaType}/${tmdbId}?api_key=${getApiKey()}&language=it-IT`;

  const response = await fetch(url);

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Errore API TMDB: ${response.statusText}`);
  }

  return response.json();
}
