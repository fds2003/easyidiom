import { GAMES } from '../game-data';

/** UTC epoch for the first daily puzzle (2022-01-27). */
const GAME_START_UTC_MS = Date.UTC(2022, 0, 27);

/**
 * Returns today's puzzle by computing
 *   floor((UTC_now - epoch) / 1 day) % GAMES.length
 *
 * Supports querying specific historical dates via ?date=YYYY-MM-DD parameter.
 * Matches the build‑time prerender and the answer‑pipeline offset.
 * @returns {{ id: string, idiom: string, isArchive: boolean, dateStr: string | null }}
 */
const getTodayGame = () => {
  const now = new Date();
  const todayUtcMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );

  let targetUtcMs = todayUtcMs;
  let isArchive = false;
  let dateStr = null;

  // Try to parse ?date= YYYY-MM-DD query param in browser env
  if (typeof window !== 'undefined' && window.location) {
    try {
      const params = new URLSearchParams(window.location.search);
      const dateParam = params.get('date');
      if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        const [y, m, d] = dateParam.split('-').map(Number);
        const parsedUtcMs = Date.UTC(y, m - 1, d);
        // Safety bounds: must be after the epoch and not in the future
        if (parsedUtcMs >= GAME_START_UTC_MS && parsedUtcMs <= todayUtcMs) {
          targetUtcMs = parsedUtcMs;
          isArchive = true;
          dateStr = dateParam;
        }
      }
    } catch (e) {
      console.error('Failed to parse date query parameter:', e);
    }
  }

  const diff = targetUtcMs - GAME_START_UTC_MS;
  const dayCount = Math.floor(diff / (1000 * 60 * 60 * 24));
  const game = GAMES[Math.max(0, dayCount % GAMES.length)];

  return {
    ...game,
    isArchive,
    dateStr,
  };
};

export default getTodayGame;
