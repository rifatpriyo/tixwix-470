import { test, expect } from "@playwright/test";

test("landing and authentication screens are usable without horizontal overflow", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Be part of/ })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Become a host", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/landing-${info.project.name}.png`,
    fullPage: true,
  });
  await page.goto("/register");
  await expect(page.getByLabel("Your name")).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  await page.screenshot({
    path: `test-results/register-${info.project.name}.png`,
    fullPage: true,
  });
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Sign in to TixWix" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("visitors are redirected from all protected pages", async ({ page }) => {
  for (const path of [
    "/dashboard",
    "/dashboard/host-application",
    "/host",
    "/admin/host-applications",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
});
test("protected JSON APIs reject anonymous users and do not cache private responses", async ({
  request,
}) => {
  for (const path of [
    "/api/me",
    "/api/host",
    "/api/host-applications",
    "/api/admin/host-applications",
  ]) {
    const response = await request.get(path);
    expect(response.status()).toBe(401);
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
});
test("registration rejects forged roles and cross-origin requests", async ({
  request,
}) => {
  const data = {
    display_name: "Test",
    email: "test@example.com",
    password: "long-password",
    role: "admin",
  };
  const invalid = await request.post("/api/auth/register", {
    data,
    headers: { origin: "http://127.0.0.1:3000" },
  });
  expect(invalid.status()).toBe(422);
  const crossSite = await request.post("/api/auth/login", {
    data: {},
    headers: { origin: "https://evil.example" },
  });
  expect(crossSite.status()).toBe(403);
});
test("confirmation callbacks reject invalid links and external destinations", async ({
  page,
}) => {
  await page.goto("/auth/callback?next=https://evil.example");
  await expect(page).toHaveURL(/\/login\?error=(confirmation|setup)$/);
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
});
