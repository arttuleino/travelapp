import MapView, { Marker } from 'react-native-maps';

import { regionFor, type TransitStop } from '@/lib/transit';
import { usePalette } from '@/theme';

/** Bus stops on a map (Apple Maps on iOS, Google Maps on Android). Tap a stop to select it. */
export function TransitMap({ stops, selected, onSelect }: { stops: TransitStop[]; selected: string | null; onSelect: (id: string) => void }) {
  const c = usePalette();
  const region = regionFor(stops);
  if (!region) return null;
  return (
    <MapView style={{ height: 320, borderRadius: 18 }} initialRegion={region}>
      {stops.map((s) => (
        <Marker
          key={s.id}
          coordinate={{ latitude: s.lat, longitude: s.lon }}
          title={s.name}
          pinColor={s.id === selected ? c.live : c.ok}
          onPress={() => onSelect(s.id)}
        />
      ))}
    </MapView>
  );
}
