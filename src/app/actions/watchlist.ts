'use server';

import { supabase } from '@/lib/supabase';
import { MediaItem } from '@/types/tmdb';
import { revalidatePath } from 'next/cache';

export async function addToWatchlist(item: MediaItem) {
  try {
    const title = item.title || item.name || 'Senza titolo';

    // 1. Inserisce il media nella tabella 'media' se non esiste già (upsert basato su tmdb_id)
    const { data: mediaData, error: mediaError } = await supabase
      .from('media')
      .upsert(
        {
          tmdb_id: item.id,
          title: title,
          media_type: item.media_type,
          poster_path: item.poster_path,
          overview: item.overview,
        },
        { onConflict: 'tmdb_id' }
      )
      .select('id')
      .single();

    if (mediaError) {
      console.error('Errore inserimento media:', mediaError);
      return { success: false, error: mediaError.message };
    }

    // 2. Collega il media alla tabella 'watchlist' con stato di default 'to_watch'
    const { error: watchlistError } = await supabase
      .from('watchlist')
      .upsert(
        {
          media_id: mediaData.id,
          status: 'to_watch',
          current_season: 1,
          current_episode: 1,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'media_id' }
      );

    if (watchlistError) {
      console.error('Errore inserimento watchlist:', watchlistError);
      return { success: false, error: watchlistError.message };
    }

    // Forza Next.js ad aggiornare i dati memorizzati nella cache della pagina
    revalidatePath('/');
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
) {
  try {
    const { error } = await supabase
      .from('watchlist')
      .update({
        current_season: season,
        current_episode: episode,
        updated_at: new Date().toISOString(),
      })
      .eq('id', watchlistId);

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
  status: 'to_watch' | 'watching' | 'completed'
) {
  try {
    const { error } = await supabase
      .from('watchlist')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', watchlistId);

    if (error) throw error;
    revalidatePath('/watchlist');
    return { success: true };
  } catch (err) {
    console.error('Errore aggiornamento stato:', err);
    return { success: false, error: 'Impossibile aggiornare lo stato' };
  }
}

export async function removeFromWatchlist(watchlistId: string) {
  try {
    const { error } = await supabase
      .from('watchlist')
      .delete()
      .eq('id', watchlistId);

    if (error) throw error;
    revalidatePath('/watchlist');
    return { success: true };
  } catch (err) {
    console.error('Errore rimozione:', err);
    return { success: false, error: 'Impossibile rimuovere dalla lista' };
  }
}
