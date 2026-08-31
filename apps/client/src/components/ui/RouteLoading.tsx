export function RouteLoading() {
  return (
    <div className="flex justify-center items-center h-screen bg-white dark:bg-slate-950">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500" role="status" aria-label="Loading page" />
    </div>
  );
}
