import type { SalesPoint } from "@/app/[locale]/admin/(dashboard)/dashboardData";
import type { SalesMetric } from "@/lib/adminConfig";

const WIDTH = 720;
const HEIGHT = 180;
const PADDING = 4;

/**
 * Линия продаж — рисуется прямо в SVG на сервере.
 *
 * Библиотека графиков сюда не нужна: это одна ломаная на 30 точках, а
 * ближайшая такая библиотека тянет в клиентский бандл больше, чем весит вся
 * страница. `viewBox` + `preserveAspectRatio` дают адаптивность бесплатно.
 */
export default function SalesChart({
  points,
  metric,
  emptyLabel,
}: {
  points: SalesPoint[];
  metric: SalesMetric;
  emptyLabel: string;
}) {
  const values = points.map((point) =>
    metric === "revenue" ? point.revenue : metric === "orders" ? point.orders : point.units
  );
  const max = Math.max(...values, 0);

  if (points.length === 0 || max === 0) {
    return (
      <p className="flex h-44 items-center justify-center rounded-xl bg-zinc-50 text-sm text-zinc-500 dark:bg-zinc-950/40">
        {emptyLabel}
      </p>
    );
  }

  const stepX = points.length > 1 ? (WIDTH - PADDING * 2) / (points.length - 1) : 0;
  const scaleY = (value: number) => HEIGHT - PADDING - (value / max) * (HEIGHT - PADDING * 2);
  const coords = values.map((value, index) => [PADDING + index * stepX, scaleY(value)] as const);

  const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${PADDING},${HEIGHT - PADDING} ${line} ${(PADDING + (points.length - 1) * stepX).toFixed(1)},${HEIGHT - PADDING}`;

  // Подписи по оси X: не чаще, чем примерно каждые 90px, иначе на телефоне
  // они сливаются в кашу.
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));

  return (
    <div className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-44 w-full"
        role="img"
      >
        <polyline points={area} className="fill-orange-500/10" />
        <polyline
          points={line}
          fill="none"
          className="stroke-orange-500"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {coords.map(([x, y], index) => (
          <circle key={index} cx={x} cy={y} r={2.5} className="fill-orange-500" />
        ))}
      </svg>

      <div className="flex justify-between gap-1 text-[11px] text-zinc-400">
        {points.map((point, index) => (
          <span key={`${point.label}-${index}`} className={index % labelEvery === 0 ? "" : "sr-only"}>
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}
