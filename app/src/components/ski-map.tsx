import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { Icon, type IconName } from '@/components/icon';
import { Text } from '@/components/text';
import { fontFamily } from '@/fonts';
import type { Place, PlaceKind, ResortMap } from '@/lib/resort-map';

/** Pin colour and icon per kind of place (the map drawing itself is always the light winter palette). */
export const KIND_STYLE: Record<PlaceKind, { color: string; ink: string; icon: IconName }> = {
  hotel: { color: '#16160F', ink: '#FFE76A', icon: 'bed' },
  lift: { color: '#2F6FDE', ink: '#FFFFFF', icon: 'lift' },
  rental: { color: '#7B4FD0', ink: '#FFFFFF', icon: 'ski' },
  food: { color: '#D9661A', ink: '#FFFFFF', icon: 'food' },
  bus: { color: '#1F8A7A', ink: '#FFFFFF', icon: 'bus' },
};

const PIN = 30;
/** Width of the box that centres a label above or below a pin (wider than the pin itself). */
const FLOAT = 170;

type Props = {
  map: ResortMap;
  /** Screen pixels per map unit. */
  scale: number;
  selectedId: string | null;
  /** The place of the next programme item: gets a yellow ring and a time label. */
  next: { placeId: string; label: string } | null;
  nameOf: (p: Place) => string;
  labelOf: (p: Place) => string;
  onSelect: (p: Place) => void;
};

/** A hand-drawn panorama of the resort (looking south: Saalbach left, Hinterglemm right) with tappable pins. */
export function SkiMap({ map, scale, selectedId, next, nameOf, labelOf, onSelect }: Props) {
  const w = map.width * scale;
  const h = map.height * scale;
  return (
    <View style={{ width: w, height: h }}>
      <Svg width={w} height={h} viewBox={`0 0 ${map.width} ${map.height}`}>
        <SaalbachPanorama />
      </Svg>
      {map.places.map((p) => {
        const s = KIND_STYLE[p.kind];
        const selected = p.id === selectedId;
        const isNext = next?.placeId === p.id;
        const size = selected ? PIN + 8 : PIN;
        return (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityLabel={labelOf(p)}
            accessibilityState={{ selected }}
            onPress={() => onSelect(p)}
            hitSlop={8}
            style={[styles.pinWrap, { left: p.x * scale - size / 2, top: p.y * scale - size - 7, zIndex: selected ? 3 : isNext ? 2 : 1 }]}>
            {isNext ? (
              <View style={[styles.float, { left: size / 2 - FLOAT / 2, bottom: '100%', marginBottom: 4 }]}>
                <View style={styles.nextTag}>
                  <Text style={styles.nextText}>{next!.label}</Text>
                </View>
              </View>
            ) : null}
            <View
              style={[
                styles.pin,
                {
                  width: size,
                  height: size,
                  backgroundColor: s.color,
                  borderColor: isNext ? '#FFE76A' : '#FFFFFF',
                  borderWidth: isNext || selected ? 3 : 2,
                },
              ]}>
              <Icon name={s.icon} size={selected ? 19 : 16} color={s.ink} strokeWidth={2.2} />
            </View>
            <View style={[styles.tail, { borderTopColor: isNext ? '#FFE76A' : '#FFFFFF' }]} />
            {selected ? (
              // Above the pin (clear of the village below), unless the next-stop time already sits there.
              <View style={[styles.float, { left: size / 2 - FLOAT / 2 }, isNext ? { top: '100%', marginTop: 2 } : { bottom: '100%', marginBottom: 4 }]}>
                <View style={styles.nameTag}>
                  <Text numberOfLines={1} style={styles.nameText}>
                    {nameOf(p)}
                  </Text>
                </View>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// ---- The drawing (1000 × 640 map units) ----

/** Ridge line from left to right; peaks: Kohlmais, Schattberg, Zwölferkogel. */
const SKYLINE: [number, number][] = [
  [0, 282], [97, 206], [160, 246], [215, 192], [305, 104], [378, 168], [442, 150], [506, 210],
  [570, 182], [640, 138], [722, 114], [800, 162], [866, 142], [936, 202], [1000, 184],
];
const pathOf = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');

/** Shadowed east faces: from each peak down to the next dip and into the forest. */
const SHADOWS = SKYLINE.slice(0, -1)
  .map((p, i) => [p, SKYLINE[i + 1]] as const)
  .filter(([a, b]) => b[1] > a[1])
  .map(([a, b]) => `M${a[0]} ${a[1]} L${b[0]} ${b[1]} L${a[0] + (b[0] - a[0]) * 0.55} 400 L${a[0] - 6} 400 Z`)
  .join(' ');

/** Fir trees between the snowline and the valley, thinned out with a fixed pattern so it looks natural. */
const TREES = (() => {
  let d = '';
  for (let row = 0; row < 10; row++) {
    const y = 330 + row * 15;
    for (let col = 0; col < 52; col++) {
      const x = col * 20 + ((row * 7) % 3) * 6 + ((col * 13) % 5);
      const keep = (col * 31 + row * 17) % 7;
      if (keep < (row < 3 ? 4 : 2)) continue;
      const s = 7 + ((col + row) % 3);
      d += `M${x} ${y - s * 1.9}l${-s} ${s * 1.9}h${s * 2}z`;
    }
  }
  return d;
})();

/** A few houses around a village centre; `church` adds a tower. */
function Village({ cx, cy, church }: { cx: number; cy: number; church?: boolean }) {
  const houses: [number, number][] = [
    [-70, 6], [-48, -8], [-26, 10], [-4, -4], [18, 12], [40, -6], [62, 8], [-58, 26], [-14, 28], [30, 26], [74, 24],
  ];
  return (
    <G>
      {houses.map(([dx, dy], i) => (
        <G key={i}>
          <Rect x={cx + dx - 8} y={cy + dy - 6} width={16} height={11} fill="#F2E3C3" stroke="#B49A73" strokeWidth={0.8} />
          <Path d={`M${cx + dx - 10} ${cy + dy - 6} L${cx + dx} ${cy + dy - 14} L${cx + dx + 10} ${cy + dy - 6} Z`} fill="#8C5A3B" />
        </G>
      ))}
      {church ? (
        <G>
          <Rect x={cx + 6} y={cy - 34} width={9} height={28} fill="#F7F1E4" stroke="#B49A73" strokeWidth={0.8} />
          <Path d={`M${cx + 4} ${cy - 34} L${cx + 10.5} ${cy - 48} L${cx + 17} ${cy - 34} Z`} fill="#4A6B4F" />
        </G>
      ) : null}
    </G>
  );
}

/** A lift: straight cable with pylons and small stations at both ends. */
function Lift({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const pylons = [0.2, 0.4, 0.6, 0.8];
  return (
    <G>
      <Line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#2A2A26" strokeWidth={2.2} />
      {pylons.map((t) => (
        <Circle key={t} cx={x1 + (x2 - x1) * t} cy={y1 + (y2 - y1) * t} r={3.2} fill="#2A2A26" />
      ))}
      <Rect x={x1 - 6} y={y1 - 5} width={12} height={9} rx={1.5} fill="#2A2A26" />
      <Rect x={x2 - 6} y={y2 - 5} width={12} height={9} rx={1.5} fill="#2A2A26" />
    </G>
  );
}

/** A piste: a white corridor through the trees with the run's colour on top. */
function Piste({ d, color }: { d: string; color: string }) {
  return (
    <G>
      <Path d={d} stroke="#FFFFFF" strokeWidth={13} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Path d={d} stroke={color} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </G>
  );
}

function Peak({ x, y, name }: { x: number; y: number; name: string }) {
  return (
    <SvgText x={x} y={y} fontSize={17} fontFamily={fontFamily('body', '700')} fill="#33475B" textAnchor="middle">
      {name}
    </SvgText>
  );
}

function SaalbachPanorama() {
  return (
    <G>
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#BFDDF7" />
          <Stop offset="1" stopColor="#EEF6FD" />
        </LinearGradient>
        <LinearGradient id="valley" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#F8FBFD" />
          <Stop offset="1" stopColor="#E9F0F4" />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={1000} height={640} fill="url(#sky)" />
      {/* Far range peeking between the peaks */}
      <Path d="M0 236 L140 156 L250 150 L380 76 L470 124 L560 92 L660 74 L770 84 L900 96 L1000 124 V420 H0 Z" fill="#E1ECF7" />
      {/* Main ridge, snow above the trees */}
      <Path d={`${pathOf(SKYLINE)} V640 H0 Z`} fill="#FFFFFF" stroke="#AFC4DA" strokeWidth={1.5} strokeLinejoin="round" />
      <Path d={SHADOWS} fill="#DCE7F3" />
      {/* Forest */}
      <Path d={TREES} fill="#3F6B4E" />
      {/* Valley floor and the road along the Glemmtal */}
      <Path d="M0 488 C 200 462, 400 506, 600 476 S 900 494, 1000 474 V640 H0 Z" fill="url(#valley)" />
      <Path
        d="M0 600 C 150 574, 260 590, 380 580 S 640 604, 760 586 S 930 576, 1000 590"
        stroke="#BDB6A2"
        strokeWidth={6}
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M0 600 C 150 574, 260 590, 380 580 S 640 604, 760 586 S 930 576, 1000 590"
        stroke="#FFFFFF"
        strokeWidth={1.2}
        strokeDasharray="7 7"
        fill="none"
      />
      {/* Pistes: blue = easy, red = intermediate, black = difficult */}
      <Piste d="M103 216 C 124 292, 158 362, 186 420 S 214 498, 226 530" color="#D6332B" />
      <Piste d="M310 112 C 344 198, 304 268, 352 330 S 334 468, 300 524" color="#D6332B" />
      <Piste d="M300 108 C 262 182, 272 262, 244 338 S 252 456, 262 522" color="#16160F" />
      <Piste d="M314 112 C 420 150, 520 190, 600 230 S 680 296, 702 356" color="#2F6FDE" />
      <Piste d="M718 122 C 690 202, 702 280, 662 334 S 702 452, 738 524" color="#D6332B" />
      <Piste d="M728 120 C 782 192, 822 262, 802 340 S 782 458, 772 526" color="#2F6FDE" />
      {/* Lifts */}
      <Lift x1={135} y1={520} x2={98} y2={214} />
      <Lift x1={290} y1={526} x2={305} y2={112} />
      <Lift x1={745} y1={526} x2={722} y2={122} />
      {/* Villages */}
      <Village cx={238} cy={548} church />
      <Village cx={776} cy={548} />
      <SvgText x={238} y={630} fontSize={16} fontFamily={fontFamily('display', '800')} fill="#4B4636" textAnchor="middle" letterSpacing={2}>
        SAALBACH
      </SvgText>
      <SvgText x={776} y={630} fontSize={16} fontFamily={fontFamily('display', '800')} fill="#4B4636" textAnchor="middle" letterSpacing={2}>
        HINTERGLEMM
      </SvgText>
      <Peak x={112} y={192} name="Kohlmais 1794 m" />
      <Peak x={305} y={88} name="Schattberg 2020 m" />
      <Peak x={722} y={98} name="Zwölferkogel 1984 m" />
    </G>
  );
}

const styles = StyleSheet.create({
  pinWrap: { position: 'absolute', alignItems: 'center' },
  pin: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  float: { position: 'absolute', width: FLOAT, alignItems: 'center' },
  nextTag: {
    backgroundColor: '#FFE76A',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  nextText: { color: '#1A1A14', fontSize: 12, fontWeight: '800' },
  nameTag: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    maxWidth: 170,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  nameText: { color: '#16160F', fontSize: 12, fontWeight: '700' },
});
