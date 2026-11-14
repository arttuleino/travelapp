import { ScrollView } from 'react-native';

import type { LiveMapProps } from '@/components/live-map-types';
import { SkiMap } from '@/components/ski-map';

/**
 * Phone app (iOS/Android): the drawn resort panorama, scrolled sideways. The browser version
 * (live-map.web.tsx) shows the real map with the piste layer and the guide's live position.
 */
export function LiveMap({ map, height, selectedId, next, nameOf, labelOf, onSelect }: LiveMapProps) {
  const scale = height / map.height;
  return (
    <ScrollView horizontal bounces={false} contentContainerStyle={{ height }}>
      <SkiMap map={map} scale={scale} selectedId={selectedId} next={next} nameOf={nameOf} labelOf={labelOf} onSelect={onSelect} />
    </ScrollView>
  );
}

/** The phone app has no real map, so it cannot place the guide or the viewer. */
export const LIVE_MAP_REAL = false;
