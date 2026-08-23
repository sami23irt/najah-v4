export default function Loading() {
  return (
    <main className="mx-auto grid min-h-[60vh] max-w-7xl place-items-center px-5 py-12" aria-busy="true" aria-live="polite">
      <div className="text-center">
        <div className="mx-auto size-10 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-800" aria-hidden="true" />
        <p className="mt-4 font-bold text-slate-600">Chargement…</p>
      </div>
    </main>
  );
}
