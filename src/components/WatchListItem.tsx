'use client';

import { useState } from 'react';
import { updateProgress, updateStatus, removeFromWatchlist } from '@/app/actions/watchlist';

interface WatchlistItemProps {
  item: {
    id: string;
    status: 'to_watch' | 'watching' | 'completed';
    current_season: number;
    current_episode: number;
    media: {
      title: string;
      poster_path: string | null;
      media_type: 'movie' | 'tv';
    };
  };
}

export default function WatchlistItem({ item }: WatchlistItemProps) {
  const [season, setSeason] = useState(item.current_season);
  const [episode, setEpisode] = useState(item.current_episode);
  const [status, setStatus] = useState(item.status);
  const [loading, setLoading] = useState(false);

  const posterUrl = item.media.poster_path
    ? `https://image.tmdb.org/t/p/w200${item.media.poster_path}`
    : null;

  async function handleEpisodeChange(delta: number) {
    const newEp = Math.max(1, episode + delta);
    setEpisode(newEp);
    await updateProgress(item.id, season, newEp);
  }

  async function handleSeasonChange(delta: number) {
    const newSeason = Math.max(1, season + delta);
    setSeason(newSeason);
    await updateProgress(item.id, newSeason, episode);
  }

  async function handleStatusChange(newStatus: 'to_watch' | 'watching' | 'completed') {
    setStatus(newStatus);
    await updateStatus(item.id, newStatus);
  }

  async function handleDelete() {
    if (confirm(`Vuoi rimuovere "${item.media.title}" dalla lista?`)) {
      setLoading(true);
      await removeFromWatchlist(item.id);
    }
  }

  if (loading) return null;

  return (
    <div className="flex gap-4 p-4 bg-slate-800/80 border border-slate-700/60 rounded-xl items-center">
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
                onClick={() => handleSeasonChange(-1)}
                className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-xs"
              >
                -
              </button>
              <span className="w-6 text-center font-bold">{season}</span>
              <button
                type="button"
                onClick={() => handleSeasonChange(1)}
                className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-xs"
              >
                +
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <span>Episodio:</span>
              <button
                type="button"
                onClick={() => handleEpisodeChange(-1)}
                className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-xs"
              >
                -
              </button>
              <span className="w-6 text-center font-bold">{episode}</span>
              <button
                type="button"
                onClick={() => handleEpisodeChange(1)}
                className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-xs"
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
          onChange={(e) => handleStatusChange(e.target.value as any)}
          className="bg-slate-700 text-slate-100 text-xs px-3 py-1.5 rounded border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="to_watch">Da vedere</option>
          <option value="watching">In corso</option>
          <option value="completed">Completato</option>
        </select>

        <button
          type="button"
          onClick={handleDelete}
          className="text-xs text-rose-400 hover:text-rose-300 px-2 py-1 transition-colors"
        >
          Rimuovi
        </button>
      </div>
    </div>
  );
}