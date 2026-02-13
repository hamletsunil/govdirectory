/** Horizontal bar chart for breakdowns (matter types, civic issues, etc.) */

interface BarItem {
  label: string;
  value: number;
}

interface MiniBarChartProps {
  items: BarItem[];
  maxItems?: number;
}

export function MiniBarChart({ items, maxItems = 6 }: MiniBarChartProps) {
  if (items.length === 0) return null;

  const sorted = [...items].sort((a, b) => b.value - a.value).slice(0, maxItems);
  const maxValue = sorted[0]?.value || 1;

  return (
    <div className="bars">
      {sorted.map((item) => (
        <div key={item.label} className="bar-row">
          <span className="bar-label" title={item.label}>
            {item.label}
          </span>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{ width: `${(item.value / maxValue) * 100}%` }}
            />
          </div>
          <span className="bar-value">
            {item.value >= 1000 ? `${(item.value / 1000).toFixed(1)}k` : item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
