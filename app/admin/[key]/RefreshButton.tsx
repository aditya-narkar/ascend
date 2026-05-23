'use client'

export default function RefreshButton() {
  return (
    <button
      onClick={() => window.location.reload()}
      className="flex items-center gap-2 border border-outline-variant px-4 py-2 font-mono text-system-label text-outline hover:text-on-surface hover:border-outline transition-colors"
    >
      <span className="material-symbols-outlined text-[16px]">refresh</span>
      REFRESH DATA
    </button>
  )
}
