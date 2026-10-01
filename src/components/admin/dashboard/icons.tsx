/**
 * Иконки дашборда.
 *
 * В проекте нет библиотеки иконок — все SVG написаны руками (см.
 * components/admin/RowActions.tsx), поэтому новая зависимость ради дашборда
 * здесь была бы единственной в своём роде. Набор повторяет смысл из задания:
 * коробка — товары, корзина — заказы, треугольник — внимание и так далее.
 */

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "h-4 w-4",
};

export function PackageIcon() {
  return (
    <svg {...base}>
      <path d="M21 8l-9-5-9 5 9 5 9-5Z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  );
}

export function CartIcon() {
  return (
    <svg {...base}>
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M2 3h3l2.4 11.2a2 2 0 002 1.6h8.2a2 2 0 002-1.6L21 7H6" />
    </svg>
  );
}

export function AlertIcon() {
  return (
    <svg {...base}>
      <path d="M10.3 3.6L2 18a2 2 0 001.7 3h16.6A2 2 0 0022 18L13.7 3.6a2 2 0 00-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

export function ImageIcon() {
  return (
    <svg {...base}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

export function FolderIcon() {
  return (
    <svg {...base}>
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7Z" />
    </svg>
  );
}

export function CarIcon() {
  return (
    <svg {...base}>
      <path d="M5 17h14M4 17v-4l2-5h12l2 5v4" />
      <circle cx="7.5" cy="17.5" r="1.5" />
      <circle cx="16.5" cy="17.5" r="1.5" />
      <path d="M6 13h12" />
    </svg>
  );
}

export function UploadIcon() {
  return (
    <svg {...base}>
      <path d="M12 16V4M8 8l4-4 4 4" />
      <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
    </svg>
  );
}

export function UsersIcon() {
  return (
    <svg {...base}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0113 0" />
      <path d="M16 5.5a3.5 3.5 0 010 7M17.5 20a6.5 6.5 0 00-2-4.7" />
    </svg>
  );
}

export function MapPinIcon() {
  return (
    <svg {...base}>
      <path d="M12 21s7-5.6 7-11a7 7 0 10-14 0c0 5.4 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export function ChartIcon() {
  return (
    <svg {...base}>
      <path d="M3 3v18h18" />
      <path d="M7 15l4-5 3 3 4-6" />
    </svg>
  );
}

export function TagIcon() {
  return (
    <svg {...base}>
      <path d="M3 12l9-9 9 9-9 9-9-9Z" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

export function ClipboardIcon() {
  return (
    <svg {...base}>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4V3h6v1" />
      <path d="M9 10h6M9 14h6" />
    </svg>
  );
}
