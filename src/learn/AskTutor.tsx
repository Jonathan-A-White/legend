// src/learn/AskTutor.tsx: the end of every Learn page. The tutor's Ask sheet (src/tutor/) opens over an item or a country but is not wired
// here yet, so this is a 'soon' button carrying the question for that page in data-prefill so the box can fill itself from it.
export function AskTutor({ prefill }: { prefill: string }) {
  return (
    <section aria-label="Ask the tutor" className="pt-2">
      <button
        type="button"
        disabled
        data-prefill={prefill}
        aria-label="Ask the tutor, soon"
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-line text-lg font-medium text-muted disabled:cursor-not-allowed disabled:opacity-60"
      >
        Ask the tutor <span className="rounded-full border border-line px-2 text-sm">soon</span>
      </button>
    </section>
  );
}
