import Svg, { Circle, Path, Rect } from 'react-native-svg';

type Shape =
  | { t: 'path'; d: string }
  | { t: 'rect'; x: string; y: string; width: string; height: string; rx?: string }
  | { t: 'circle'; cx: string; cy: string; r: string };

// Line icons from the design prototype (24-unit grid, 2 px stroke, round caps).
const ICONS = {
  home: [{ t: 'path', d: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' }],
  cal: [
    { t: 'rect', x: '3', y: '5', width: '18', height: '16', rx: '3' },
    { t: 'path', d: 'M3 10h18M8 3v4M16 3v4' },
  ],
  chat: [{ t: 'path', d: 'M4 5h16v11H9l-5 4z' }],
  plus: [
    { t: 'rect', x: '3', y: '3', width: '18', height: '18', rx: '5' },
    { t: 'path', d: 'M12 8v8M8 12h8' },
  ],
  info: [{ t: 'path', d: 'M3 19l6-12 4 7 2-3 6 8z' }],
  check: [
    { t: 'circle', cx: '12', cy: '12', r: '9' },
    { t: 'path', d: 'M8 12.5l2.5 2.5L16 9.5' },
  ],
  arrow: [{ t: 'path', d: 'M5 12h14M13 6l6 6-6 6' }],
  back: [{ t: 'path', d: 'M19 12H5M11 6l-6 6 6 6' }],
  phone: [{ t: 'path', d: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z' }],
  alert: [
    { t: 'path', d: 'M12 3l10 18H2z' },
    { t: 'path', d: 'M12 10v5M12 18v.01' },
  ],
  plane: [{ t: 'path', d: 'M2 16l20-6-3-2-7 2-5-5-2 1 3 6-4 1-2-2-1 1z' }],
  bed: [
    { t: 'path', d: 'M3 18V7M3 13h18v5M21 13a3 3 0 0 0-3-3h-7v3' },
    { t: 'circle', cx: '7', cy: '10.5', r: '1.6' },
  ],
  pin: [
    { t: 'path', d: 'M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z' },
    { t: 'circle', cx: '12', cy: '9', r: '2.5' },
  ],
  euro: [{ t: 'path', d: 'M17 6.5A6.5 6.5 0 1 0 17 17.5M4 10h9M4 14h9' }],
  logout: [{ t: 'path', d: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10' }],
  send: [{ t: 'path', d: 'M4 12l16-8-6 16-2-6z' }],
  edit: [{ t: 'path', d: 'M4 20h4L19 9l-4-4L4 16z' }],
  swap: [{ t: 'path', d: 'M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7' }],
  mega: [{ t: 'path', d: 'M3 10v4h4l7 5V5L7 10zM18 9a4 4 0 0 1 0 6' }],
  clock: [
    { t: 'circle', cx: '12', cy: '12', r: '9' },
    { t: 'path', d: 'M12 7v5l3 2' },
  ],
  users: [
    { t: 'circle', cx: '9', cy: '8', r: '3.5' },
    { t: 'path', d: 'M2 20a7 7 0 0 1 14 0M16 4.5a3.5 3.5 0 0 1 0 7M18 13.5a7 7 0 0 1 4 6.5' },
  ],
  // Map tab and resort map pins.
  map: [
    { t: 'path', d: 'M3 6.5l6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5z' },
    { t: 'path', d: 'M9 4v13.5M15 6.5V20' },
  ],
  lift: [
    { t: 'path', d: 'M3 4.5l18-2.5M12 3.3V8' },
    { t: 'rect', x: '6.5', y: '8', width: '11', height: '11', rx: '2.5' },
    { t: 'path', d: 'M6.5 13h11' },
  ],
  ski: [{ t: 'path', d: 'M4 20L15 4M9 20L20 4M8 15.5l3 2M13 15.5l3 2' }],
  food: [{ t: 'path', d: 'M5 3v5a3 3 0 0 0 6 0V3M8 3v18M18 21V3c-2.5 1.5-3.5 5-3.5 8.5H18' }],
  bus: [
    { t: 'rect', x: '4', y: '3', width: '16', height: '14', rx: '3' },
    { t: 'path', d: 'M4 10h16M8 17v3M16 17v3M8 13.5h.01M16 13.5h.01' },
  ],
  // Live map controls.
  locate: [
    { t: 'circle', cx: '12', cy: '12', r: '7' },
    { t: 'circle', cx: '12', cy: '12', r: '2.5' },
    { t: 'path', d: 'M12 2v3M12 19v3M2 12h3M19 12h3' },
  ],
  expand: [{ t: 'path', d: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5' }],
  external: [{ t: 'path', d: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5' }],
} satisfies Record<string, Shape[]>;

export type IconName = keyof typeof ICONS;

/** The same icon as an SVG markup string, for HTML map markers (browser only). */
export function iconSvg(name: IconName, size: number, color: string, strokeWidth = 2) {
  const shapes: Shape[] = ICONS[name];
  const body = shapes
    .map((s) =>
      s.t === 'path'
        ? `<path d="${s.d}"/>`
        : s.t === 'rect'
          ? `<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" rx="${s.rx ?? 0}"/>`
          : `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}"/>`,
    )
    .join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export function Icon({ name, size = 22, color, strokeWidth = 2 }: { name: IconName; size?: number; color: string; strokeWidth?: number }) {
  const shapes: Shape[] = ICONS[name];
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden>
      {shapes.map((s, i) =>
        s.t === 'path' ? (
          <Path key={i} d={s.d} />
        ) : s.t === 'rect' ? (
          <Rect key={i} x={s.x} y={s.y} width={s.width} height={s.height} rx={s.rx} />
        ) : (
          <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} />
        ),
      )}
    </Svg>
  );
}

/** The operator mark: a mountain outline, drawn next to the app name in the top bar. */
export function Mountain({ color, width = 26 }: { color: string; width?: number }) {
  return (
    <Svg width={width} height={(width * 18) / 26} viewBox="0 0 26 18" aria-hidden>
      <Path d="M1 17L9 5l4 5 4-7 8 14z" fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
    </Svg>
  );
}
