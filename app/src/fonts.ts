import { Archivo_700Bold } from '@expo-google-fonts/archivo/700Bold';
import { Archivo_800ExtraBold } from '@expo-google-fonts/archivo/800ExtraBold';
import { Figtree_400Regular } from '@expo-google-fonts/figtree/400Regular';
import { Figtree_500Medium } from '@expo-google-fonts/figtree/500Medium';
import { Figtree_600SemiBold } from '@expo-google-fonts/figtree/600SemiBold';
import { Figtree_700Bold } from '@expo-google-fonts/figtree/700Bold';
import { Figtree_800ExtraBold } from '@expo-google-fonts/figtree/800ExtraBold';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { useFonts } from 'expo-font';

// Typefaces from the design prototype: Archivo for headings and buttons, Figtree for text,
// JetBrains Mono for clock times. Each weight is its own font file.
export const FONT_FILES = {
  Archivo_700Bold,
  Archivo_800ExtraBold,
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
  JetBrainsMono_500Medium,
};

/** Loads the fonts; `true` once they are ready (or failed, then the system font is used). */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts(FONT_FILES);
  return loaded || !!error;
}

export type Face = 'body' | 'display' | 'mono';

const BODY: Record<string, string> = {
  '400': 'Figtree_400Regular',
  '500': 'Figtree_500Medium',
  '600': 'Figtree_600SemiBold',
  '700': 'Figtree_700Bold',
  '800': 'Figtree_800ExtraBold',
  '900': 'Figtree_800ExtraBold',
};

/** Font family for a face and weight. */
export function fontFamily(face: Face, weight: string | number | undefined): string {
  const w = weight === 'bold' ? '700' : weight == null || weight === 'normal' ? '400' : String(weight);
  if (face === 'mono') return 'JetBrainsMono_500Medium';
  if (face === 'display') return Number(w) >= 800 ? 'Archivo_800ExtraBold' : 'Archivo_700Bold';
  return BODY[w] ?? (Number(w) < 400 ? BODY['400'] : BODY['700']);
}
