'use client';

import { useState, useTransition } from 'react';
import { updateProgress, updateStatus, removeFromWatchlist } from '@/app/actions/watchlist';
import type { ActionResult, WatchlistEntry, WatchStatus } from '@/types/watchlist';

export default function WatchlistItem({ item }: { item: WatchlistEntry }) {
  const [season, setSeason] = useState(item.current_season);
  const [episode, setEpisode] = useState(item.current_episode);
  const [status, setStatus] = useState<WatchStatus>(item.status);
  const [removed, setRemoved] = useState(false);
  // Un solo salvataggio alla volta: i controlli restano disabilitati finché è in corso,
  // così click rapidi non mandano richieste in parallelo che arrivano in ordine sparso.
  const [isPending, startTransition] = useTransition();

  const posterUrl = item.media.poster_path
    ? `https://image.tmdb.org/t/p/w200${item.media.poster_path}`
    : null;

  /** Aggiorna subito la UI, salva, e ripristina i valori precedenti se il salvataggio fallisce. */
  function save(apply: () => void, rollback: () => void, action: () => Promise<ActionResult>) {
    apply();
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        rollback();
        alert(result.error);
      }
    });
  }

  function handleEpisodeChange(delta: number) {
    const prev = episode;
    const next = Math.max(1, episode + delta);
    if (next === prev) return;
    save(
      () => setEpisode(next),
      () => setEpisode(prev),
      () => updateProgress(item.id, season, next)
    );
  }

  function handleSeasonChange(delta: number) {
    const prev = season;
    const next = Math.max(1, season + delta);
    if (next === prev) return;
    save(
      () => setSeason(next),
      () => setSeason(prev),
      () => updateProgress(item.id, next, episode)
    );
  }

  function handleStatusChange(next: WatchStatus) {
    const prev = status;
    save(
      () => setStatus(next),
      () => setStatus(prev),
      () => updateStatus(item.id, next)
    );
  }

  function handleDelete() {
    if (!confirm(`Vuoi rimuovere "${item.media.title}" dalla lista?`)) return;
    // Nasconde la riga solo dopo che il DB ha confermato la cancellazione
    startTransition(async () => {
      const result = await removeFromWatchlist(item.id);
      if (result.success) {
        setRemoved(true);
      } else {
        alert(result.error);
      }
    });
  }

  if (removed) return null;

  return (
    <div
      aria-busy={isPending}
      className={`flex gap-4 p-4 bg-slate-800/80 border border-slate-700/60 rounded-xl items-center transition-opacity ${
        isPending ? 'opacity-70' : ''
      }`}
    >
      <div className="w-16 h-24 bg-slate-900 rounded overflow-hidden flex-shrink-0">
        {posterUrl ? (
          <img src={posterUrl} alt={item.media.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs text-center p-1">
            No img
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <h2 className="text-base font-semibold text-white truncate">{item.media.title}</h2>
        <span className="text-xs uppercase font-semibold text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded inline-block mt-1">
          {item.media.media_type === 'movie' ? 'Film' : 'Serie TV'}
        </span>

        {item.media.media_type === 'tv' && (
          <div className="flex items-center gap-4 mt-3 text-sm text-slate-300">
            <div className="flex items-center gap-1.5">
              <span>Stagione:</span>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleSeasonChange(-1)}
                className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-xs disabled:opacity-50 disabled:cursor-wait"
              >
                -
              </button>
              <span className="w-6 text-center font-bold">{season}</span>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleSeasonChange(1)}
                className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-xs disabled:opacity-50 disabled:cursor-wait"
              >
                +
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <span>Episodio:</span>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleEpisodeChange(-1)}
                className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-xs disabled:opacity-50 disabled:cursor-wait"
              >
                -
              </button>
              <span className="w-6 text-center font-bold">{episode}</span>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleEpisodeChange(1)}
                className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-xs disabled:opacity-50 disabled:cursor-wait"
              >
                +
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
        <select
          value={status}
          disabled={isPending}
          onChange={(e) => handleStatusChange(e.target.value as WatchStatus)}
          className="bg-slate-700 text-slate-100 text-xs px-3 py-1.5 rounded border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="to_watch">Da vedere</option>
          <option value="watching">In corso</option>
          <option value="completed">Completato</option>
        </select>

        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="text-xs text-rose-400 hover:text-rose-300 px-2 py-1 transition-colors disabled:opacity-50 disabled:cursor-wait"
        >
          Rimuovi
        </button>
      </div>
    </div>
  );
}