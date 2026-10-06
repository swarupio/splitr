import { expect, test } from "@playwright/test";

test("public landing page renders without signing in", async ({ page }) => {
  // This smoke test checks public rendering; real Clerk login is a manual check.
  await page.route("https://clerk.example.test/**", (route) => route.abort());
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("Splitr");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "The smartest way to split expenses with friends",
    }),
  ).toBeVisible();
  await expect(page.locator('a[href="/dashboard"]').first()).toBeVisible();
  await page.getByRole("link", { name: "See How It Works" }).click();
  await expect(page).toHaveURL(/#how-it-works$/);
  await expect(
    page.getByRole("heading", {
      name: "Splitting expenses has never been easier",
    }),
  ).toBeVisible();
});
