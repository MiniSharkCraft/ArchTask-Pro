import { AlertTriangle, X } from 'lucide-react'

export default function ConfirmModal({
  title,
  message,
  isAlert = false,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="rounded-2xl p-6 w-full max-w-md shadow-2xl"
        style={{
          background: 'rgba(16,16,32,0.98)',
          border: `1px solid ${isAlert ? 'rgba(239,68,68,0.4)' : 'rgba(99,102,241,0.35)'}`,
          boxShadow: isAlert
            ? '0 0 40px rgba(239,68,68,0.15)'
            : '0 0 40px rgba(99,102,241,0.12)',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg"
              style={{
                background: isAlert ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)',
              }}
            >
              <AlertTriangle
                size={18}
                style={{ color: isAlert ? '#f87171' : '#818cf8' }}
              />
            </div>
            <h3
              className="font-semibold text-sm"
              style={{ color: isAlert ? '#fca5a5' : '#c7d2fe' }}
            >
              {title}
            </h3>
          </div>
          <button onClick={onCancel} className="text-slate-500 hover:text-slate-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Message */}
        <p className="text-sm text-slate-300 leading-relaxed mb-6 whitespace-pre-wrap">
          {message}
        </p>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="btn btn-ghost">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`btn ${isAlert ? 'btn-danger' : 'btn-primary'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
