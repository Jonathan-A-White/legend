// Pin the zone for the whole run, before any worker starts, so clock-format tests pass on a host in any zone.
export default function setup(): void {
  process.env.TZ = 'UTC';
}
