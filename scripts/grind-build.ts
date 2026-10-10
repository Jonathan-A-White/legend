// scripts/grind-build.ts: writes what the tutor's grind is told about the settings (`npm run grind:build`): the list between the markers
// of grinds/legend-ask.md and the `settingsChanges` property of its answer schema, both from the settings registry
// (src/settings/registry.ts, the talkable ones only). Run it after a setting is added or changed; a second run changes nothing, and
// tests/unit/legend-ask-grind.test.ts fails when the files are behind.
import { readFileSync, writeFileSync } from 'node:fs';
import { formatJson, withSettingsBlock, withSettingsChanges } from '../src/settings/grindText.ts';

const INSTRUCTIONS = 'grinds/legend-ask.md';
const SCHEMA = 'schemas/legend-ask-answer-1.0.schema.json';

const schema = withSettingsChanges(JSON.parse(readFileSync(SCHEMA, 'utf8')) as Record<string, unknown>);
writeFileSync(SCHEMA, `${formatJson(schema)}\n`);
writeFileSync(INSTRUCTIONS, withSettingsBlock(readFileSync(INSTRUCTIONS, 'utf8')));
console.log(`wrote ${INSTRUCTIONS} and ${SCHEMA}`);
