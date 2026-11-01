// Shown the instant a link is tapped, while the next page renders on the server -- without
// it the previous page just sits there on a slow phone connection, which read as the tap
// not registering.
export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-12" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-48 animate-pulse rounded-md bg-white/5" />
      <div className="h-24 animate-pulse rounded-xl bg-white/5" />
      <div className="h-24 animate-pulse rounded-xl bg-white/5" />
      <div className="h-24 animate-pulse rounded-xl bg-white/5" />
    </main>
  );
}
