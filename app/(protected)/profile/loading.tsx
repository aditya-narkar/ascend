export default function ProfileLoading() {
  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5 animate-pulse">
      <div className="bg-card border border-border rounded-sm p-5">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-border flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-7 bg-border rounded-sm w-36" />
            <div className="h-3 bg-border/60 rounded-sm w-28" />
            <div className="h-5 bg-border rounded-sm w-20" />
          </div>
        </div>
      </div>
      <div className="bg-card border border-border rounded-sm p-5 h-24" />
      <div className="grid grid-cols-2 gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card border border-border rounded-sm p-3 h-16" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className={`bg-card border border-border rounded-sm p-4 h-20 ${i === 5 ? 'col-span-2' : ''}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="h-7 bg-border rounded w-24" />
        ))}
      </div>
    </div>
  )
}
