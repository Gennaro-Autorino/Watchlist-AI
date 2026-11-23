'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { supabase } from '@/lib/supabase';
import { getMediaDetails } from '@/lib/tmdb';
import { WATCH_STATUSES, type ActionResult } from '@/types/watchlist';

// Le server action sono endpoint pubblici: ogni input va validato lato server.
const addSchema = z.object({
  tmdbId: z.number().int().positive(),
  mediaType: z.enum(['movie', 'tv']),
});

const watchlistIdSchema = z.string().min(1).max(100);

const progressSchema = z.object({
  watchlistId: watchlistIdSchema,
  season: z.number().int().min(1).max(1000),
  episode: z.number().int().min(1).max(10000),
});

const statusSchema = z.object({
  watchlistId: watchlistIdSchema,
  status: z.enum(WATCH_STATUSES),
});

function revalidateAll() {
  revalidatePath('/');
  revalidatePath('/watchlist');
}

export async function addToWatchlist(
  tmdbId: number,
  mediaType: 'movie' | 'tv'
): Promise<ActionResult> {
  const parsed = addSchema.safeParse({ tmdbId, mediaType });
  if (!parsed.success) {
    return { success: false, error: 'Dati non validi' };
  }

  try {
    // 1. I dati del titolo arrivano da TMDB, non dal client (che potrebbe falsificarli)
    const details = await getMediaDetails(parsed.data.tmdbId, parsed.data.mediaType);
    if (!details) {
      return { success: false, error: 'Titolo non trovato su TMDB' };
    }

    // 2. Inserisce o aggiorna il media nella tabella 'media'.
    //    Chiave: (tmdb_id, media_type), perché film e serie hanno id TMDB separati.
    //    Richiede il vincolo unique definito in supabase/schema.sql.
    const { data: mediaData, error: mediaError } = await supabase
      .from('media')
      .upsert(
        {
          tmdb_id: details.id,
          title: details.title || details.name || 'Senza titolo',
          media_type: parsed.data.mediaType,
          poster_path: details.poster_path,
          overview: details.overview,
        },
        { onConflict: 'tmdb_id,media_type' }
      )
      .select('id')
      .single();

    if (mediaError) {
      console.error('Errore inserimento media:', mediaError);
      return { success: false, error: 'Impossibile salvare il titolo' };
    }

    // 3. Aggiunge alla watchlist solo se non c'è già.
    //    ignoreDuplicates = ON CONFLICT DO NOTHING: non azzera stato e progressi esistenti.
    const { error: watchlistError } = await supabase.from('watchlist').upsert(
      {
        media_id: mediaData.id,
        status: 'to_watch',
        current_season: 1,
        current_episode: 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'media_id', ignoreDuplicates: true }
    );

    if (watchlistError) {
      console.error('Errore inserimento watchlist:', watchlistError);
      return { success: false, error: 'Impossibile aggiungere alla lista' };
    }

    revalidateAll();
    return { success: true };
  } catch (err) {
    console.error('Errore inatteso:', err);
    return { success: false, error: 'Errore generico del server' };
  }
}

export async function updateProgress(
  watchlistId: string,
  season: number,
  episode: number
): Promise<ActionResult> {
  const parsed = progressSchema.safeParse({ watchlistId, season, episode });
  if (!parsed.success) {
    return { success: false, error: 'Dati non validi' };
  }

  try {
    const { error } = await supabase
      .from('watchlist')
      .update({
        current_season: parsed.data.season,
        current_episode: parsed.data.episode,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.data.watchlistId);

    if (error) throw error;
    revalidatePath('/watchlist');
    return { success: true };
  } catch (err) {
    console.error('Errore aggiornamento progresso:', err);
    return { success: false, error: 'Impossibile aggiornare il progresso' };
  }
}

export async function updateStatus(
  watchlistId: string,
  status: (typeof WATCH_STATUSES)[number]
): Promise<ActionResult> {
  const parsed = statusSchema.safeParse({ watchlistId, status });
  if (!parsed.success) {
    return { success: false, error: 'Dati non validi' };
  }

  try {
    const { error } = await supabase
      .from('watchlist')
      .update({
        status: parsed.data.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.data.watchlistId);

    if (error) throw error;
    revalidatePath('/watchlist');
    return { success: true };
  } catch (err) {
    console.error('Errore aggiornamento stato:', err);
    return { success: false, error: 'Impossibile aggiornare lo stato' };
  }
}

export async function removeFromWatchlist(watchlistId: string): Promise<ActionResult> {
  const parsed = watchlistIdSchema.safeParse(watchlistId);
  if (!parsed.success) {
    return { success: false, error: 'Dati non validi' };
  }

  try {
    const { error } = await supabase.from('watchlist').delete().eq('id', parsed.data);

    if (error) throw error;
    revalidateAll();
    return { success: true };
  } catch (err) {
    console.error('Errore rimozione:', err);
    return { success: false, error: 'Impossibile rimuovere dalla lista' };
  }
}
