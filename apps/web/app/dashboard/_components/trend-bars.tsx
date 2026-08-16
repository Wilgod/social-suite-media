interface TrendBarsProps {
  data: { date: string; value: number }[];
  height?: number;
}

/** Compact single-series bar sparkline. Thin violet bars, rounded data-ends, native tooltips. */
export function TrendBars({ data, height = 56 }: TrendBarsProps) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const barWidth = 6;
  const gap = 3;
  const width = data.length * (barWidth + gap) - gap;
  const labelIndices = getLabelIndices(data.length);

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" role="img">
        <line x1={0} y1={height - 0.5} x2={width} y2={height - 0.5} stroke="#e5e5e5" strokeWidth={1} />
        {data.map((d, i) => {
          const barHeight = Math.max(2, (d.value / max) * (height - 4));
          const x = i * (barWidth + gap);
          const y = height - barHeight;
          return (
            <rect key={d.date} x={x} y={y} width={barWidth} height={barHeight} rx={2} className="fill-violet-500">
              <title>{`${d.date}: ${d.value.toLocaleString()}`}</title>
            </rect>
          );
        })}
      </svg>
      {labelIndices.length > 0 && (
        <div className="mt-1 flex justify-between text-[10px] text-neutral-400">
          {labelIndices.map((i) => (
            <span key={data[i].date}>{formatShortDate(data[i].date)}</span>
          ))}
        </div>
      )}

      {data.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] font-medium text-violet-600 hover:text-violet-700">
            View exact numbers
          </summary>
          <table className="mt-2 w-full text-xs">
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.date} className="border-t border-neutral-100">
                  <td className="py-1 text-neutral-500">{formatShortDate(d.date)}</td>
                  <td className="py-1 text-right font-medium text-neutral-900">{d.value.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}

/** First/last (and middle, once there's room) — never one label per bar. */
function getLabelIndices(length: number): number[] {
  if (length === 0) return [];
  if (length === 1) return [0];
  if (length < 10) return [0, length - 1];
  return [0, Math.floor((length - 1) / 2), length - 1];
}

function formatShortDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
