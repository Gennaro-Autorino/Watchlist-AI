'use client';

import { useState } from 'react';
import { MediaItem } from '@/types/tmdb';
import { addToWatchlist } from '@/app/actions/watchlist';

export default function AddButton({ item }: { item: MediaItem }) {
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);

  async function handleAdd() {
    setLoading(true);
    const result = await addToWatchlist(item);
    setLoading(false);

    if (result.success) {
      setAdded(true);
    } else {
      alert(`Errore durante il salvataggio: ${result.error}`);
    }
  }

  return (
    <button
      type="button"
      onClick={handleAdd}
      disabled={loading || added}
      className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
        added
          ? 'bg-emerald-600 text-white cursor-default'
          : loading
          ? 'bg-slate-600 text-slate-300 cursor-wait'
          : 'bg-slate-700 hover:bg-slate-600 text-slate-100'
      }`}
    >
      {added ? '✓ In lista' : loading ? 'Salvataggio...' : '+ Aggiungi'}
    </button>
  );
}