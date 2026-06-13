import { describe, expect, it } from "vitest";
import {
  oppositeFront,
  orientationFor,
  revealLabel,
  sideName,
  type CardSide,
} from "./study-direction";

describe("orientationFor", () => {
  it("shows Japanese first by default, revealing the meaning", () => {
    expect(orientationFor("japanese")).toEqual({
      front: "japanese",
      back: "english",
    });
  });

  it("reverses to show the meaning first, revealing the Japanese", () => {
    expect(orientationFor("english")).toEqual({
      front: "english",
      back: "japanese",
    });
  });

  it("always puts a distinct side on the back", () => {
    for (const front of ["japanese", "english"] as CardSide[]) {
      const { front: f, back } = orientationFor(front);
      expect(f).toBe(front);
      expect(back).not.toBe(f);
    }
  });
});

describe("oppositeFront", () => {
  it("flips to the other leading side", () => {
    expect(oppositeFront("japanese")).toBe("english");
    expect(oppositeFront("english")).toBe("japanese");
  });

  it("returns to the original side when flipped twice", () => {
    for (const front of ["japanese", "english"] as CardSide[]) {
      expect(oppositeFront(oppositeFront(front))).toBe(front);
    }
  });
});

describe("sideName", () => {
  it("names each side for accessible labels", () => {
    expect(sideName("japanese")).toBe("Japanese word");
    expect(sideName("english")).toBe("English meaning");
  });
});

describe("revealLabel", () => {
  it("labels the reveal button by the side being revealed", () => {
    expect(revealLabel("english")).toBe("Show meaning");
    expect(revealLabel("japanese")).toBe("Show Japanese");
  });
});
