export default function StatsLoading() {
  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5 animate-pulse">
      <div className="space-y-1">
        <div className="h-6 bg-surface-container-high w-40" />
        <div className="h-3 bg-surface-container-high/60 w-56" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="card-gradient border border-outline-variant p-4 h-24" />
        ))}
      </div>
      <div className="card-gradient border border-outline-variant p-5 h-36" />
      <div className="card-gradient border border-outline-variant p-5 h-56" />
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card-gradient border border-outline-variant p-4 h-24" />
        ))}
      </div>
    </div>
  )
}
