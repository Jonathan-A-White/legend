// src/ui/BuildVersion.tsx: 'v<version> · <UTC time> · <commit>', stamped by the build (vite.config.ts), so the collector
// can tell on their phone whether a new build has loaded (PWA best practices, section 25).
export function BuildVersion({ className = '' }: { className?: string }) {
  return (
    <p data-testid="build-version" className={`break-words text-center text-sm text-muted ${className}`}>
      v{__APP_VERSION__}
    </p>
  );
}
