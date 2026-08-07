// Rounds a Date down to the nearest N-minute bucket. Used so repeated calls within that
// window produce an identical timestamp -- and therefore an identical request URL --
// letting theOddsApiProvider's cache actually hit instead of every call computing a
// microseconds-different "now" that can never match a previous cache key.
export function roundDownToBucket(date: Date, bucketMinutes: number): Date {
  const ms = bucketMinutes * 60 * 1000;
  return new Date(Math.floor(date.getTime() / ms) * ms);
}
