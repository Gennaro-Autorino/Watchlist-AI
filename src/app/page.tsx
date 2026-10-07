import SearchBar from '@/components/SearchBar';
import { searchMedia } from '@/lib/tmdb';
import AddButton from '@/components/AddButton';

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function Home({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const query = resolvedParams.q || '';
  const data = query ? await searchMedia(query) : null;

  return (
    <main className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-6 text-white tracking-tight">
        Watchlist AI
      </h1>

      <SearchBar />

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {data && data.results.length > 0 ? (
          data.results
            .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
            .map((item) => {
              const title = item.title || item.name;
              const releaseYear = (item.release_date || item.first_air_date || '').split('-')[0];
              const posterUrl = item.poster_path
                ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
                : null;

              return (
                <div
                  key={item.id}
                  className="border border-slate-800 rounded-lg overflow-hidden shadow-lg flex flex-col bg-slate-800/80 hover:border-slate-700 transition-all"
                >
                  <div className="w-full aspect-[2/3] bg-slate-900 overflow-hidden">
                    {posterUrl ? (
                      <img
                        src={posterUrl}
                        alt={title || 'Locandina'}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                        Nessuna locandina
                      </div>
                    )}
                  </div>

                  <div className="p-4 flex flex-col flex-1">
                    <h2 className="text-lg font-semibold text-white line-clamp-1">{title}</h2>
                    <div className="flex justify-between items-center text-xs text-slate-400 mt-1 mb-3">
                      <span className="uppercase font-semibold tracking-wider px-2 py-0.5 bg-slate-700/60 rounded">
                        {item.media_type === 'movie' ? 'Film' : 'Serie TV'}
                      </span>
                      {releaseYear && <span>{releaseYear}</span>}
                    </div>

                    <p className="text-sm text-slate-300 line-clamp-3 mb-4">
                      {item.overview || 'Nessuna descrizione disponibile.'}
                    </p>

                    <div className="mt-auto flex justify-between items-center pt-3 border-t border-slate-700/60 text-sm">
                      <span className="font-semibold text-amber-400 flex items-center gap-1">
                        ★ {typeof item.vote_average === 'number' ? item.vote_average.toFixed(1) : 'N/D'}
                      </span>
                      <AddButton item={item} />
                    </div>
                  </div>
                </div>
              );
            })
        ) : query ? (
          <p className="col-span-full text-center text-slate-400">
            Nessun risultato trovato per &quot;{query}&quot;.
          </p>
        ) : (
          <p className="col-span-full text-center text-slate-500">
            Cerca un film, una serie TV o un anime per iniziare.
          </p>
        )}
      </div>
    </main>
  );
}