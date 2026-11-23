import { ApiError, GoogleGenAI } from '@google/genai';
import { z } from 'zod';

/**
 * Correzione dei titoli con Gemini.
 *
 * Usata solo quando la ricerca su TMDB (anche quella tollerante) non trova
 * nulla di simile: per esempio "avngers" o "titanc", dove l'errore è nelle
 * prime lettere o il titolo giusto non compare tra i risultati.
 *
 * Opzionale: senza GEMINI_API_KEY la funzione restituisce [] e la ricerca
 * funziona come prima.
 */

// Modello "lite": per correggere un titolo basta, ed è molto più veloce.
// Misurato (nov 2026): ~0,5-1 s e risposte corrette; gemini-3.8-flash impiegava
// 15-30 s o rispondeva 503 (sovraccarico).
const MODEL = 'gemini-3.5-flash-lite';
const TIMEOUT_MS = 8_000;
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 300;

const SuggestionsSchema = z.object({
  titles: z
    .array(z.string())
    .describe('Da 0 a 3 titoli reali di film o serie TV, dal più probabile al meno probabile'),
});

const SYSTEM_PROMPT = `Correggi le ricerche di un'app per film e serie TV.
L'utente scrive il titolo che cerca, spesso con errori di battitura, lettere mancanti o in più, o parole storpiate.
Restituisci i titoli reali di film o serie TV che l'utente intendeva, dal più probabile al meno probabile, al massimo 3.
Scrivi ogni titolo nella forma più comune, così come si cerca su TMDB (titolo originale o titolo italiano).
Se il testo è già corretto, restituisci quel titolo. Se non riconosci nessun titolo plausibile, restituisci una lista vuota.`;

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

// Cache in memoria delle correzioni già fatte: la stessa ricerca non richiama Gemini.
// Si svuota al riavvio del server.
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 ora
const CACHE_MAX_ENTRIES = 500;
const cache = new Map<string, { titles: string[]; expiresAt: number }>();

function cacheKey(query: string): string {
  return query.trim().toLowerCase();
}

function readCache(query: string): string[] | undefined {
  const entry = cache.get(cacheKey(query));
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    cache.delete(cacheKey(query));
    return undefined;
  }
  return entry.titles;
}

function writeCache(query: string, titles: string[]) {
  // Map mantiene l'ordine di inserimento: elimina la voce più vecchia
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(cacheKey(query), { titles, expiresAt: Date.now() + CACHE_TTL_MS });
}

async function askGemini(ai: GoogleGenAI, query: string, signal: AbortSignal): Promise<string[]> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: query.slice(0, 200),
    config: {
      systemInstruction: SYSTEM_PROMPT,
      // Risposta in JSON che rispetta lo schema: una lista di titoli, non testo libero
      responseMimeType: 'application/json',
      responseJsonSchema: z.toJSONSchema(SuggestionsSchema),
      abortSignal: signal,
    },
  });

  if (!response.text) return [];

  // Il JSON viene comunque validato: il modello potrebbe non rispettare lo schema
  const parsed = SuggestionsSchema.safeParse(JSON.parse(response.text));
  if (!parsed.success) return [];

  return parsed.data.titles
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.length <= 200)
    .slice(0, 3);
}

/** 503 = modello sovraccarico, 429 = troppe richieste: di solito passa in un attimo. */
function isTemporary(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 503 || error.status === 429);
}

export async function suggestTitles(query: string): Promise<string[]> {
  const ai = getClient();
  if (!ai) return [];

  const cached = readCache(query);
  if (cached) return cached;

  // Un solo limite di tempo per tutti i tentativi: la ricerca non resta bloccata
  const signal = AbortSignal.timeout(TIMEOUT_MS);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const titles = await askGemini(ai, query, signal);
      writeCache(query, titles);
      return titles;
    } catch (error) {
      if (isTemporary(error) && attempt < MAX_ATTEMPTS && !signal.aborted) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }
      // L'AI è un aiuto in più: se fallisce, la ricerca prosegue senza
      if (error instanceof ApiError) {
        console.error(`Errore API Gemini ${error.status}:`, error.message);
      } else if (signal.aborted) {
        console.error(`Gemini non ha risposto entro ${TIMEOUT_MS / 1000} s`);
      } else {
        console.error('Errore correzione titolo con AI:', error);
      }
      return [];
    }
  }
  return [];
}
