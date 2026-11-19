import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { eventUsers } from "../support/event-users";
const enabled =
  process.env.SUPABASE_TEST_RESERVATIONS === "true" &&
  !!process.env.SUPABASE_TEST_EVENT_USERS_FILE;
test.skip(
  !enabled,
  "Requires the isolated seeded reservation demo and dedicated accounts.",
);
test("two customers select, preview, reserve, restore and release a seat", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const { slug } = JSON.parse(
    readFileSync(".qa/reservation-demo.json", "utf8"),
  );
  const ca = await browser.newContext(),
    cb = await browser.newContext();
  const a = await ca.newPage(),
    b = await cb.newPage();
  async function login(page: Page, role: string) {
    const u = eventUsers().find((u) => u.role === role)!;
    await page.goto("/login");
    await page.getByLabel("Email address").fill(u.email);
    await page.getByLabel("Password", { exact: true }).fill(u.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  }
  try {
    await login(a, "customer");
    await login(b, "customer_b");
    await a.goto(`/events/${slug}`);
    await b.goto(`/events/${slug}`);
    await a.getByRole("button", { name: "A1, available", exact: true }).click();
    await a.getByRole("button", { name: "Explore 3D seat view" }).click();
    await expect(a.locator("canvas")).toBeVisible();
    const front = await a.locator("canvas").screenshot();
    await a.getByRole("button", { name: "D1, available", exact: true }).focus();
    await expect(
      a.getByText(/Approximate audience view from Main D1/),
    ).toBeVisible();
    const rear = await a.locator("canvas").screenshot();
    expect(front.equals(rear)).toBe(false);
    await a.getByRole("button", { name: "Continue to checkout" }).click();
    await expect(a).toHaveURL(/\/checkout\//);
    const reservationUrl = a.url();
    await expect(a.getByText("Status: pending")).toBeVisible();
    await a.reload();
    await expect(a.getByRole("timer")).toBeVisible();
    await expect(
      b.getByRole("button", { name: "A1, unavailable", exact: true }),
    ).toHaveAttribute("aria-disabled", "true");
    const forbidden = await cb.request.get(
      "/api/reservations/" + reservationUrl.split("/").pop(),
    );
    expect(forbidden.status()).toBe(404);
    await a.getByRole("button", { name: "Release reservation" }).click();
    await expect(a.getByText("Status: canceled")).toBeVisible();
    await expect(
      b.getByRole("button", { name: "A1, available", exact: true }),
    ).toHaveAttribute("aria-disabled", "false");
    await b.getByRole("button", { name: "A1, available", exact: true }).click();
    await b.getByRole("button", { name: "Continue to checkout" }).click();
    await expect(b.getByText("Status: pending")).toBeVisible();
    await b.getByRole("button", { name: "Release reservation" }).click();
    await expect(b.getByText("Status: canceled")).toBeVisible();
  } finally {
    await ca.close();
    await cb.close();
  }
});
