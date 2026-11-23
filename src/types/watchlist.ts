import type { MediaType } from './tmdb';

export const WATCH_STATUSES = ['to_watch', 'watching', 'completed'] as const;
export type WatchStatus = (typeof WATCH_STATUSES)[number];

export interface WatchlistEntry {
  id: string;
  status: WatchStatus;
  current_season: number;
  current_episode: number;
  media: {
    title: string;
    poster_path: string | null;
    media_type: MediaType;
  };
}

export type ActionResult = { success: true } | { success: false; error: string };
