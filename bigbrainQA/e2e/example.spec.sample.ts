// e2e/example.spec.sample.ts — a template for ONE critical journey.
//
// Rule of thumb (see rules/12): one thin journey per vertical slice, against the
// running app. Not hundreds of brittle UI assertions. Copy this into e2e/<flow>.spec.ts
// and make it real. A slice isn't "done" until one journey like this is green.

import { test, expect } from "@playwright/test";

test("home page loads and shows the app", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/.+/); // replace with a real, specific assertion
});

// Example of a real journey to model yours on (sign-up → see dashboard):
//
// test("a new user can sign up and reach the dashboard", async ({ page }) => {
//   await page.goto("/signup");
//   await page.getByLabel("Email").fill("new@example.com");
//   await page.getByLabel("Password").fill("correct-horse-battery");
//   await page.getByRole("button", { name: "Create account" }).click();
//   await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
// });
