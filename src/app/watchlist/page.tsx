import { supabase } from '@/lib/supabase';
import WatchlistItem from '@/components/WatchListItem';
import Link from 'next/link';

export const revalidate = 0; // Disabilita la cache statica per visualizzare sempre dati freschi dal DB

export default async function WatchlistPage() {
  // Esegue una query con JOIN relazionale: recupera la riga di watchlist insieme ai dati del media correlato
  const { data: items, error } = await supabase
    .from('watchlist')
    .select(`
      id,
      status,
      current_season,
      current_episode,
      media (
        title,
        poster_path,
        media_type
      )
    `)
    .order('updated_at', { ascending: false });

  if (error) {
    return (
      <main className="p-8 max-w-4xl mx-auto text-center">
        <p className="text-rose-400">Errore nel caricamento della lista: {error.message}</p>
      </main>
    );
  }

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">La Mia Watchlist</h1>
          <p className="text-sm text-slate-400 mt-1">Gestisci i tuoi titoli e aggiorna i progressi</p>
        </div>
        <Link
          href="/"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + Cerca Nuovi Titoli
        </Link>
      </div>

      <div className="flex flex-col gap-4">
        {items && items.length > 0 ? (
          items.map((item: any) => <WatchlistItem key={item.id} item={item} />)
        ) : (
          <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl">
            <p className="text-slate-400 mb-4">Nessun titolo presente nella tua watchlist.</p>
            <Link
              href="/"
              className="text-sm text-blue-400 hover:text-blue-300 underline underline-offset-4"
            >
              Inizia cercando un film o una serie TV
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}