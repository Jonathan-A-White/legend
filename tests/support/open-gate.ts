// tests/support/open-gate.ts: a gate that is already open, for a feature about something behind it (docs/testing.md):
// pass it as <App gate={openGate} />. The gate's own behaviour is features/gate.feature.
import type { GateProps } from '../../src/gate';

export const openGate: Omit<GateProps, 'children'> = {
  check: async () => ({ state: 'held', outpoint: { txid: 'a'.repeat(64), vout: 0 }, collection: 'legend', checkedAt: new Date().toISOString() }),
};
