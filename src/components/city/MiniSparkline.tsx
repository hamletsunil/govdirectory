/** Tiny SVG sparkline — no dependencies, pure SVG path */

interface MiniSparklineProps {
  data: number[];
  labels?: { first: string; last: string };
  color?: string;
  height?: number;
}

export function MiniSparkline({
  data,
  labels,
  color,
  height = 72,
}: MiniSparklineProps) {
  if (data.length < 2) return null;

  const width = 300;
  const padding = 4;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => ({
    x: padding + (i / (data.length - 1)) * (width - 2 * padding),
    y: padding + (1 - (v - min) / range) * (height - 2 * padding),
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x},${height} L${points[0].x},${height} Z`;

  const lineStyle = color ? { stroke: color } : undefined;
  const areaStyle = color ? { fill: `${color}20` } : undefined;

  return (
    <div className="sparkline">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <path d={areaPath} className="sparkline-area" style={areaStyle} />
        <path d={linePath} className="sparkline-line" style={lineStyle} />
      </svg>
      {labels && (
        <div className="sparkline-labels">
          <span>{labels.first}</span>
          <span>{labels.last}</span>
        </div>
      )}
    </div>
  );
}
