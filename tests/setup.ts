import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
// Not '@testing-library/react': importing it here would register its auto-unmount before
// the step files' dont-cleanup-after-each import can switch that off.
import { configure } from '@testing-library/dom';

// waitFor/findBy default to 1 s, which a loaded host outruns. vitest's testTimeout (20 s) stays well above this.
configure({ asyncUtilTimeout: 5000 });

// The day's silver and gold price comes from xaus.com; no test goes to the network for it. A test that wants a price sets its own
// (setMetalPriceSource); the fetch itself is tested with a fake fetch (tests/unit/metal-prices.test.ts).
import { setMetalPriceSource } from '../src/services/metalPrice';
setMetalPriceSource(async () => null);
