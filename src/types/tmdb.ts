export type MediaType = 'movie' | 'tv';

export interface MediaItem {
  id: number;
  title?: string;       // Presente se è un film
  name?: string;        // Presente se è una serie TV / anime
  original_title?: string; // Titolo in lingua originale (film)
  original_name?: string;  // Titolo in lingua originale (serie)
  popularity?: number;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  media_type: MediaType;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
}

export interface TMDBSearchResponse {
  page: number;
  results: MediaItem[];
  total_pages: number;
  total_results: number;
}

/** Risposta di /movie/{id} e /tv/{id} (solo i campi usati). */
export interface MediaDetails {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  poster_path: string | null;
}
