'use client';

import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

export default function SearchBar() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

  // Inizializza l'input con il valore già presente nell'URL (se esiste)
  const [term, setTerm] = useState(searchParams.get('q')?.toString() || '');

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);

    if (term.trim()) {
      params.set('q', term.trim());
    } else {
      params.delete('q');
    }

    // Aggiorna l'URL senza ricaricare l'intera pagina del browser
    replace(`${pathname}?${params.toString()}`);
  }

  return (
  <form onSubmit={handleSearch} className="flex gap-2 w-full max-w-md mx-auto mb-8">
    <input
      type="text"
      value={term}
      onChange={(e) => setTerm(e.target.value)}
      placeholder="Cerca film, serie TV o anime..."
      className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
    />
    <button
      type="submit"
      className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
    >
      Cerca
    </button>
  </form>
);
}