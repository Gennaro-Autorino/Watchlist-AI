'use client'; // Gli error boundary devono essere Client Component

import { useEffect } from 'react';

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="p-8 max-w-xl mx-auto text-center">
      <h1 className="text-xl font-semibold text-white mb-2">Qualcosa è andato storto</h1>
      <p className="text-sm text-slate-400 mb-6">
        Il servizio potrebbe non essere raggiungibile al momento. Riprova tra poco.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
      >
        Riprova
      </button>
    </main>
  );
}
