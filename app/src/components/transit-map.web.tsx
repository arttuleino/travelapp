import type { TransitStop } from '@/lib/transit';

/** Maps are native only; in the browser the stop list below the map is enough. */
export function TransitMap(_props: { stops: TransitStop[]; selected: string | null; onSelect: (id: string) => void }) {
  return null;
}
