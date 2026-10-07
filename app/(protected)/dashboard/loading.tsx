export default function DashboardLoading() {
  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-3 bg-surface-container-high w-16" />
          <div className="h-6 bg-surface-container-high w-32" />
        </div>
        <div className="h-6 bg-surface-container-high w-10" />
      </div>
      <div className="card-gradient border border-outline-variant p-5 h-28" />
      <div className="card-gradient border border-outline-variant p-4 h-12" />
      <div className="grid grid-cols-4 gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card-gradient border border-outline-variant p-3 h-16" />
        ))}
      </div>
      <div className="card-gradient border border-outline-variant p-5 h-48" />
      <div className="card-gradient border border-outline-variant p-5 h-24" />
    </div>
  )
}
