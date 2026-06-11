/**
 * The fixed palette of colors a tag can take. Colors are stored on the tag as
 * raw CSS color strings (oklch, matching the app's washi/sumi palette), so they
 * render with a plain inline style and survive in Firestore without any lookup.
 * Tones are picked to stay legible as a small dot, as chip text, and as a faint
 * chip tint over the paper background.
 */
export type TagColor = {
  /** Stable id, handy for swatch keys. */
  id: string;
  /** Human label, used for the swatch's accessible name. */
  label: string;
  /** The CSS color value persisted on the tag and used to paint it. */
  value: string;
};

export const TAG_COLORS: readonly TagColor[] = [
  { id: "rose", label: "Rose", value: "oklch(0.62 0.16 18)" },
  { id: "amber", label: "Amber", value: "oklch(0.68 0.13 70)" },
  { id: "green", label: "Green", value: "oklch(0.56 0.12 150)" },
  { id: "teal", label: "Teal", value: "oklch(0.58 0.09 200)" },
  { id: "blue", label: "Blue", value: "oklch(0.55 0.12 255)" },
  { id: "violet", label: "Violet", value: "oklch(0.55 0.14 300)" },
  { id: "pink", label: "Pink", value: "oklch(0.62 0.15 350)" },
  { id: "slate", label: "Slate", value: "oklch(0.52 0.03 250)" },
];

/** Default swatch when nothing else applies (the first palette color). */
export const DEFAULT_TAG_COLOR = TAG_COLORS[0].value;

/**
 * Suggest a color for a new tag: the first palette color not already taken by an
 * existing tag, so freshly created tags look distinct. Falls back to cycling
 * through the palette once every color is in use.
 */
export function nextTagColor(usedColors: string[]): string {
  const used = new Set(usedColors);
  const free = TAG_COLORS.find((color) => !used.has(color.value));
  if (free) return free.value;
  return TAG_COLORS[usedColors.length % TAG_COLORS.length].value;
}
