/**
 * Fire a custom analytics event via Google Analytics 4 (gtag).
 * Includes session-level deduplication to prevent inflated engagement metrics.
 *
 * @param  {...any} args — first arg is the event name, second optional is `{ props: { ... } }`
 *
 * Usage:
 *   fireEvent('Hard mode')
 *   fireEvent('Click: Share', { props: { type: 'share' } })
 */

// Track which events have been fired in this session to prevent duplicates.
// GA4 counts the same event name (without unique props) multiple times as separate engagements.
const firedEvents = new Set();

export default (...args) => {
  if (typeof window.gtag !== 'function') return;
  const [eventName, detail] = args;
  if (!eventName) return;
  const params = detail?.props || {};

  // Build a dedup key from event name + stringified params
  const dedupKey = `${eventName}::${JSON.stringify(params)}`;

  // Only fire once per session per unique event
  if (firedEvents.has(dedupKey)) return;
  firedEvents.add(dedupKey);

  window.gtag('event', eventName, params);
};
