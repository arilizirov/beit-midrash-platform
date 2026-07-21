/**
 * Thin e2e: the journeys a stranger can reach. These run against a real
 * server + real database, so they prove the guards and the Hebrew RTL shell
 * end-to-end rather than in isolation.
 *
 * Deliberately NOT covered here: the authenticated join journey. The magic
 * link is printed to the server console (email delivery is a deploy gate),
 * so driving it needs a seeded session — that lands with the topics UI slice
 * rather than being faked now.
 */
import { expect, test } from "@playwright/test";

test("an anonymous visitor cannot reach the group and lands on sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/signin/);
  await expect(page.getByRole("heading", { name: "בית המדרש הדיגיטלי" })).toBeVisible();
  await expect(page.getByText("הכניסה לחברי החבורה בלבד")).toBeVisible();
});

test("the shell is Hebrew and right-to-left", async ({ page }) => {
  await page.goto("/signin");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("lang", "he");
  await expect(html).toHaveAttribute("dir", "rtl");
});

test("an uninvited address gets the same screen as an invited one (no enumeration)", async ({
  page,
}) => {
  await page.goto("/signin");
  await page.getByLabel("דוא״ל").fill("stranger@nowhere.test");
  await page.getByRole("button", { name: "שליחת קישור כניסה" }).click();
  // identical response to a legitimate request — the difference is only that
  // no link is ever sent
  await expect(page.getByRole("heading", { name: "בדקו את הדוא״ל" })).toBeVisible();
});

test("a forged invite token is refused", async ({ page }) => {
  await page.goto("/invite?g=not-a-group&t=not-a-token");
  await expect(page.getByRole("heading", { name: "ההזמנה אינה בתוקף" })).toBeVisible();
});

test("the admin area is not reachable without a session", async ({ page }) => {
  await page.goto("/admin/invitations");
  await expect(page).toHaveURL(/\/signin/);
});
