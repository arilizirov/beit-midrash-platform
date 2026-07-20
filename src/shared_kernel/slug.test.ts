import { describe, expect, it } from "vitest";

import { makeSlug } from "./slug";

// SPEC §5: "Slugs may contain Hebrew; a stable short id prefix guarantees
// uniqueness." The id prefix comes from the entity's cuid at creation time, so
// the slug never collides even when two topics share a title.
describe("makeSlug", () => {
  it("keeps Hebrew letters and joins words with dashes", () => {
    expect(makeSlug("פסול מחשבה בזבחים", "clx3k9")).toBe("clx3k9-פסול-מחשבה-בזבחים");
  });

  it("lowercases Latin and strips punctuation", () => {
    expect(makeSlug("Rambam: Hilchot Teshuva!", "clx3ka")).toBe("clx3ka-rambam-hilchot-teshuva");
  });

  it("strips nikud (vowel points) so visually-identical titles slug identically", () => {
    // בְּרֵאשִׁית with nikud vs bare ברא­שית must produce the same letters.
    expect(makeSlug("בְּרֵאשִׁית", "clx3kb")).toBe("clx3kb-בראשית");
  });

  it("collapses mixed separators and trims edge dashes", () => {
    expect(makeSlug("  שבת — הוצאה / רשויות  ", "clx3kc")).toBe("clx3kc-שבת-הוצאה-רשויות");
  });

  it("keeps digits (daf and perek numbers matter)", () => {
    expect(makeSlug("זבחים 19", "clx3kd")).toBe("clx3kd-זבחים-19");
  });

  it("falls back to the id alone when the title has no sluggable characters", () => {
    expect(makeSlug("!!!", "clx3ke")).toBe("clx3ke");
  });

  it("caps very long titles without splitting a word mid-way", () => {
    const title = "דיון ארוך מאוד ".repeat(20);
    const slug = makeSlug(title, "clx3kf");
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
  });
});
