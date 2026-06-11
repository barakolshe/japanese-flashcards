import type { CSSProperties } from "react";

/**
 * Shared presentation for tags. A tag's color rides on a small dot and a faint
 * tint, while the label stays in ink — keeping text legible against the paper
 * background regardless of which palette color the user picked (the deck's
 * "restrained" color strategy, per DESIGN.md).
 */

/** A small filled dot in the tag's color, used to prefix a tag label. */
export function TagDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="size-2 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

/** Faint tint of a tag's color for a selected/active chip background + border. */
export function tagTint(color: string): CSSProperties {
  return {
    borderColor: `color-mix(in oklab, ${color} 45%, transparent)`,
    backgroundColor: `color-mix(in oklab, ${color} 12%, transparent)`,
  };
}
