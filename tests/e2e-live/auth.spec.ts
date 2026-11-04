import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { Database } from "@/lib/domain";

const enabled = process.env.TIXWIX_LIVE_AUTH_TESTS === "true";
test.skip(
  !enabled,
  "Opt in with TIXWIX_LIVE_AUTH_TESTS and dedicated test credentials.",
);

const runId = randomUUID();
const customerEmail = `tixwix-browser-customer-${runId}@example.com`;
const adminEmail = `tixwix-browser-admin-${runId}@example.com`;
const password = `TixWix-${randomUUID()}-aA9!`;
let owner: SupabaseClient<Database>;

test.beforeAll(async () => {
  const url = process.env.SUPABASE_TEST_URL;
  const key = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error(
      "Live tests need a development project URL and a server-only test key.",
    );
  owner = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const account = await owner.auth.admin.createUser({
    email: adminEmail,
    password,
    email_confirm: true,
    user_metadata: { display_name: "Browser test administrator" },
  });
  if (account.error || !account.data.user)
    throw new Error(
      `Test admin setup failed: ${account.error?.code ?? "unknown"}`,
    );
  const grant = await owner
    .from("user_roles")
    .insert({ user_id: account.data.user.id, role: "admin" });
  if (grant.error)
    throw new Error(`Test admin role setup failed: ${grant.error.code}`);
});

test.afterAll(async () => {
  if (!owner) return;
  // Match only the two exact random addresses allocated by this run.
  const users = await owner.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error)
    throw new Error("Could not list temporary accounts for cleanup.");
  for (const user of users.data.users.filter(
    (u) => u.email === customerEmail || u.email === adminEmail,
  )) {
    const cleanup = await owner.auth.admin.deleteUser(user.id);
    if (cleanup.error)
      throw new Error(`Temporary account cleanup failed for ${user.id}.`);
  }
});

test("real registration, login, persisted session, logout, and approved host access", async ({
  page,
  browser,
}) => {
  await page.goto("/register");
  await page.getByLabel("Your name").fill("Browser test customer");
  await page.getByLabel("Email address").fill(customerEmail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);

  let me = await page.request.get("/api/me");
  expect(me.status()).toBe(200);
  const registered = await me.json();
  expect(registered.user.roles).toEqual(["customer"]);
  expect(registered.profile.display_name).toBe("Browser test customer");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Welcome, Browser test customer." }),
  ).toBeVisible();
  expect(
    (await page.request.get("/api/admin/host-applications")).status(),
  ).toBe(403);
  expect((await page.request.get("/api/host")).status()).toBe(403);

  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get("/api/me")).status()).toBe(401);
  await page.getByLabel("Email address").fill(customerEmail);
  await page.getByLabel("Password", { exact: true }).fill("incorrect-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "email or password is incorrect",
  );
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/dashboard/host-application");
  await page
    .getByLabel("Organizer or organization name")
    .fill(`Browser test organizer ${runId}`);
  await page.getByLabel("Contact email").fill(customerEmail);
  await page.getByLabel("Contact phone").fill("+8801712345678");
  await page
    .getByLabel("About your organization and events")
    .fill(
      "We organize student concerts and community cultural events in Dhaka.",
    );
  await page
    .getByRole("button", { name: "Submit application", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your application is in review." }),
  ).toBeVisible();
  const application = (
    await (await page.request.get("/api/host-applications")).json()
  ).application;

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  try {
    await adminPage.goto("http://127.0.0.1:3000/login");
    await adminPage.getByLabel("Email address").fill(adminEmail);
    await adminPage.getByLabel("Password", { exact: true }).fill(password);
    await adminPage
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await expect(adminPage).toHaveURL(/\/dashboard$/);
    await adminPage.goto(
      `http://127.0.0.1:3000/admin/host-applications/${application.id}`,
    );
    await adminPage
      .getByRole("button", { name: "Approve application", exact: true })
      .click();
    await expect(
      adminPage.getByRole("heading", { name: "Review complete" }),
    ).toBeVisible();
  } finally {
    await adminContext.close();
  }

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "You’re an approved host." }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Open host dashboard", exact: true })
    .click();
  await expect(page).toHaveURL(/\/host$/);
  await expect(
    page.getByRole("heading", { name: "Host dashboard", exact: true }),
  ).toBeVisible();
  me = await page.request.get("/api/me");
  const approved = await me.json();
  expect(approved.user.id).toBe(registered.user.id);
  expect(approved.user.roles).toEqual(
    expect.arrayContaining(["customer", "host"]),
  );
});
