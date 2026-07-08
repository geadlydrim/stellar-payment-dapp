export function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;

  const width = 240;
  const height = 40;
  const pad = 4;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * (width - pad * 2) + pad;
    const y = height - pad - ((p - min) / range) * (height - pad * 2);
    return { x, y, value: p };
  });

  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const last = coords[coords.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      role="img"
      aria-label="Balance trend over recent activity"
    >
      <path
        d={path}
        fill="none"
        stroke="var(--qf-text-4)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={7} fill="transparent">
          <title>{c.value.toFixed(2)} XLM</title>
        </circle>
      ))}
      <circle cx={last.x} cy={last.y} r={4} fill="#5EEAD4" stroke="var(--qf-card-bg)" strokeWidth={2} />
    </svg>
  );
}
