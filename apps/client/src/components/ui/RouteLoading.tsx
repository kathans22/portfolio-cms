export function RouteLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div
        className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500 dark:border-slate-800 dark:border-t-indigo-400"
        role="status"
        aria-label="Loading page"
      />
    </div>
  );
}
