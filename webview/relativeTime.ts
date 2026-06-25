const UNITS: { limit: number; div: number; one: string; many: string }[] = [
  { limit: 60, div: 1, one: 'second', many: 'seconds' },
  { limit: 3600, div: 60, one: 'minute', many: 'minutes' },
  { limit: 86400, div: 3600, one: 'hour', many: 'hours' },
  { limit: 604800, div: 86400, one: 'day', many: 'days' },
  { limit: 2629800, div: 604800, one: 'week', many: 'weeks' },
  { limit: 31557600, div: 2629800, one: 'month', many: 'months' }
];

/** Formats an ISO date as a short relative string like "3 days ago". */
export function relativeTime(iso: string): string {
  if (!iso) {
    return '';
  }
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) {
    return '';
  }
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 10) {
    return 'just now';
  }
  for (const unit of UNITS) {
    if (seconds < unit.limit) {
      const value = Math.floor(seconds / unit.div);
      return `${value} ${value === 1 ? unit.one : unit.many} ago`;
    }
  }
  const years = Math.floor(seconds / 31557600);
  return `${years} ${years === 1 ? 'year' : 'years'} ago`;
}
