'use client'

export default function ProtectedError({ unstable_retry }: { unstable_retry: () => void }) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <p className="font-mono text-system-label text-error mb-3">SYSTEM ERROR</p>
        <p className="font-mono text-body-sm text-on-surface-variant mb-6">
          Something went wrong loading this page. Your progress is safe. Try again.
        </p>
        <button
          onClick={() => unstable_retry()}
          className="font-mono text-system-label tracking-widest border border-primary-container px-6 py-3 text-secondary hover:bg-primary-container/20 transition-colors"
        >
          TRY AGAIN
        </button>
      </div>
    </div>
  )
}
