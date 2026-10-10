// src/nav/useRouteEvents.ts: each time the address moves, keep it as where to reopen (lastRoute.ts) and tell the bus
// (route.changed). App calls it once.
import { useEffect } from 'react';
import { publish } from '../events/bus';
import { saveLastRoute } from './lastRoute';
import { routeOf, useAddress } from './route';

export function useRouteEvents(): void {
  const hash = useAddress();
  useEffect(() => {
    saveLastRoute(hash);
    publish({ kind: 'route.changed', hash, route: routeOf(hash) });
  }, [hash]);
}
