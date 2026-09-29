export default function AnalyticsLoading() {
  return (
    <div className="p-6 lg:p-8">
      <div className="h-5 w-28 rounded-md bg-white" />
      <div className="mt-2 h-4 w-64 rounded-md bg-white/70" />
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-36 rounded-2xl bg-white" />
        ))}
      </div>
    </div>
  );
}
