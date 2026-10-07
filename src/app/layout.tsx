import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Watchlist AI',
  description: 'Traccia film e serie TV con supporto AI',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body suppressHydrationWarning className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
        <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/" className="font-bold text-lg text-white tracking-tight">
              Watchlist <span className="text-blue-500">AI</span>
            </Link>
            <nav className="flex items-center gap-6 text-sm font-medium">
              <Link href="/" className="text-slate-300 hover:text-white transition-colors">
                Cerca
              </Link>
              <Link href="/watchlist" className="text-slate-300 hover:text-white transition-colors">
                La Mia Lista
              </Link>
            </nav>
          </div>
        </header>

        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}