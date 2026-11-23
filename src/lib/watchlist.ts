import { supabase } from '@/lib/supabase';
import type { MediaType } from '@/types/tmdb';
import type { WatchlistEntry } from '@/types/watchlist';

/** Tutte le voci della watchlist, con i dati del media collegato. */
export async function getWatchlist(): Promise<WatchlistEntry[]> {
  const { data, error } = await supabase
    .from('watchlist')
    .select(
      `
      id,
      status,
      current_season,
      current_episode,
      media (
        title,
        poster_path,
        media_type
      )
    `
    )
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`Errore nel caricamento della lista: ${error.message}`);

  // Senza tipi generati da Supabase la relazione 'media' non è tipizzata:
  // il cast riflette lo schema (watchlist.media_id -> media.id, relazione molti-a-uno).
  return (data ?? []) as unknown as WatchlistEntry[];
}

/**
 * Chiave univoca di un titolo TMDB. Film e serie hanno spazi di id separati:
 * il film 123 e la serie 123 sono titoli diversi.
 */
export function mediaKey(mediaType: MediaType, tmdbId: number): string {
  return `${mediaType}:${tmdbId}`;
}

/** Chiavi (vedi mediaKey) dei titoli già nella watchlist, per i pulsanti "In lista". */
export async function getWatchlistMediaKeys(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('watchlist')
    .select('media ( tmdb_id, media_type )');

  if (error) {
    // Non blocca la ricerca: al massimo i pulsanti mostrano "+ Aggiungi"
    console.error('Errore lettura tmdb_id watchlist:', error);
    return new Set();
  }

  const rows = (data ?? []) as unknown as {
    media: { tmdb_id: number; media_type: MediaType } | null;
  }[];
  return new Set(
    rows.flatMap((row) => (row.media ? [mediaKey(row.media.media_type, row.media.tmdb_id)] : []))
  );
}
