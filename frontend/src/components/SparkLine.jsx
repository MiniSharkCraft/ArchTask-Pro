/**
 * SparkLine: a minimal SVG line chart for time-series metrics.
 * Data is a circular buffer of numbers 0-100.
 */
export default function SparkLine({ data = [], color = '#6366f1', height = 40, width = '100%' }) {
  if (data.length < 2) return null

  const pts = data.slice(-60) // last 60 samples
  const n   = pts.length
  const W   = 300  // internal SVG width
  const H   = height

  const xStep = W / (n - 1)
  const yScale = (v) => H - (Math.min(100, Math.max(0, v)) / 100) * H

  // Build SVG polyline points
  const points = pts.map((v, i) => `${i * xStep},${yScale(v)}`).join(' ')

  // Area fill path
  const fillPath =
    `M0,${H} ` +
    pts.map((v, i) => `L${i * xStep},${yScale(v)}`).join(' ') +
    ` L${(n - 1) * xStep},${H} Z`

  const gradId = `sg-${color.replace('#', '')}`

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ width, height, display: 'block' }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.30" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Area */}
      <path d={fillPath} fill={`url(#${gradId})`} />
      {/* Line */}
      <polyline
        points={points}
        className="chart-line"
        stroke={color}
        fill="none"
      />
    </svg>
  )
}
