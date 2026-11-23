'use client';

import { useState, useTransition } from 'react';
import type { MediaType } from '@/types/tmdb';
import { addToWatchlist } from '@/app/actions/watchlist';

interface AddButtonProps {
  tmdbId: number;
  mediaType: MediaType;
  initiallyInList: boolean;
}

export default function AddButton({ tmdbId, mediaType, initiallyInList }: AddButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [added, setAdded] = useState(initiallyInList);

  function handleAdd() {
    startTransition(async () => {
      const result = await addToWatchlist(tmdbId, mediaType);

      if (result.success) {
        setAdded(true);
      } else {
        alert(`Errore durante il salvataggio: ${result.error}`);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleAdd}
      disabled={isPending || added}
      className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
        added
          ? 'bg-emerald-600 text-white cursor-default'
          : isPending
          ? 'bg-slate-600 text-slate-300 cursor-wait'
          : 'bg-slate-700 hover:bg-slate-600 text-slate-100'
      }`}
    >
      {added ? '✓ In lista' : isPending ? 'Salvataggio...' : '+ Aggiungi'}
    </button>
  );
}
