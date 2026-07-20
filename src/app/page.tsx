// Walking-skeleton home page. The real dashboard (widgets + activity, SPEC §5)
// arrives in the Periphery stage. Render verified manually in a browser
// (lang=he, dir=rtl, no console errors); automated render proof arrives with
// Playwright (bigbrainQA) — until then this page is typechecked, not tested.
export default function HomePage() {
  return (
    <main>
      <h1>בית המדרש הדיגיטלי</h1>
      <p>השלד עומד. הבנייה — פרוסה אחר פרוסה.</p>
    </main>
  );
}
