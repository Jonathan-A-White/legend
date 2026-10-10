// src/learn/AskTutor.tsx: the end of every Learn page. The tutor's AskBox is another story's (its j1); until it lands this is the same
// 'soon' button the item view shows, carrying the question for that page in data-prefill so the box can fill itself from it.
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
