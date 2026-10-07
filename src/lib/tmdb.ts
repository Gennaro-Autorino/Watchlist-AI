import { TMDBSearchResponse } from '@/types/tmdb';

const BASE_URL = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const API_KEY = process.env.TMDB_API_KEY;

export async function searchMedia(query: string): Promise<TMDBSearchResponse> {
  if (!API_KEY) {
    throw new Error('TMDB_API_KEY non trovata nelle variabili d’ambiente');
  }

  const url = `${BASE_URL}/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(
    query
  )}&language=it-IT&include_adult=false`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Errore API TMDB: ${response.statusText}`);
  }

  return response.json();
}