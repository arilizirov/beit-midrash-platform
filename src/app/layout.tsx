import type { Metadata } from "next";
import type { ReactNode } from "react";

// SPEC §1/§5: Hebrew-first, RTL-native — the root document is Hebrew RTL, not a
// translated skin. Per-segment bidi isolation (dir="auto") happens at the
// component level for mixed Hebrew/Latin content like source refs.
export const metadata: Metadata = {
  title: "בית המדרש הדיגיטלי",
  description: "ארכיון חי ובר־חיפוש של לימוד החבורה — נושאים, דיונים, סיכומים ומקורות.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
