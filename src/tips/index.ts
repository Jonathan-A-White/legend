// src/tips/index.ts: one-time tips and the usage log. A screen draws its tip with <HintCard event={…} />; the shell runs useUsageLog.
export { HintCard } from './HintCard';
export { CAMERA_OPENED, GLOBE_OPENED, HINTS, TUTOR_OPENED, hints } from './hints';
export { startUsageLog, usageWritesSettled } from './usageLog';
export { useUsageLog } from './useUsageLog';
