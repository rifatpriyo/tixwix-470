import { test, expect, type Page } from "@playwright/test";
import {
  approveTestHosts,
  eventUsers,
  loginEventUser,
} from "../support/event-users";
const enabled =
  process.env.SUPABASE_TEST_EVENTS === "true" &&
  !!process.env.SUPABASE_TEST_EVENT_USERS_FILE;
test.skip(
  !enabled,
  "Opt in with SUPABASE_TEST_EVENTS and dedicated event test accounts.",
);
test("Dhaka Unplugged correction, publication, visitor discovery and withdrawal", async ({
  browser,
  request,
}) => {
  test.setTimeout(180000);
  await approveTestHosts();
  const hostContext = await browser.newContext(),
    adminContext = await browser.newContext(),
    visitorContext = await browser.newContext();
  const host = await hostContext.newPage(),
    admin = await adminContext.newPage(),
    visitor = await visitorContext.newPage();
  async function login(page: Page, role: string) {
    const user = eventUsers().find((u) => u.role === role)!;
    await page.goto("/login");
    await page.getByLabel("Email address").fill(user.email);
    await page.getByLabel("Password", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  }
  await login(host, "host");
  await login(admin, "admin");
  await host.goto("/host");
  await host.getByRole("link", { name: "Create event", exact: true }).click();
  await host.getByLabel("Event title", { exact: true }).fill("Dhaka Unplugged");
  await host.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(host).toHaveURL(/\/host\/events\/[0-9a-f-]+$/);
  const editor = host.url(),
    id = editor.split("/").pop()!;
  await host
    .getByRole("button", { name: "Submit for review", exact: true })
    .click();
  await expect(
    host.getByText("Required before submitting for review.").first(),
  ).toBeVisible();
  await host.reload();
  await expect(host.getByLabel("Event title", { exact: true })).toHaveValue(
    "Dhaka Unplugged",
  );
  await host
    .getByLabel("Description", { exact: true })
    .fill("An evening of acoustic music with local artists in Dhaka.");
  await host.getByLabel("Category", { exact: true }).selectOption("concert");
  await host.getByLabel("Venue name", { exact: true }).fill("Acoustic Hall");
  await host
    .getByLabel("Venue address", { exact: true })
    .fill("12 Dhanmondi Road");
  await host.getByLabel("City", { exact: true }).fill("Dhaka");
  await host
    .getByLabel("Starts at (Asia/Dhaka)", { exact: true })
    .fill("2099-12-20T18:00");
  await host
    .getByLabel("Ends at (Asia/Dhaka)", { exact: true })
    .fill("2099-12-20T21:00");
  await host
    .getByLabel("Ticket category", { exact: true })
    .fill("General Admission");
  await host.getByLabel("Ticket price (BDT)", { exact: true }).fill("500");
  await host.getByLabel("Capacity", { exact: true }).fill("100");
  await host
    .getByLabel("Poster image", { exact: true })
    .setInputFiles("public/concert.png");
  await expect(host.getByRole("status")).toContainText("Poster uploaded", {
    timeout: 30000,
  });
  await host.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(host.getByRole("status")).toContainText("Draft saved");
  await host
    .getByRole("button", { name: "Submit for review", exact: true })
    .click();
  await expect(host.getByRole("status")).toContainText("Submitted");
  await expect(host.getByLabel("Event title", { exact: true })).toBeDisabled();
  await admin.goto("/admin/events");
  await expect(
    admin.getByRole("heading", { name: "Dhaka Unplugged", exact: true }),
  ).toBeVisible();
  await admin.locator(`a[href='/admin/events/${id}']`).click();
  await admin
    .getByLabel("Feedback", { exact: true })
    .fill("Please specify the north entrance.");
  await admin
    .getByRole("button", { name: "Request changes", exact: true })
    .click();
  await expect(
    admin.getByText("Please specify the north entrance.", { exact: true }),
  ).toBeVisible();
  await host.goto("/host");
  await expect(
    host
      .locator("article")
      .filter({ has: host.locator(`a[href='/host/events/${id}']`) })
      .getByText("Review feedback: Please specify the north entrance.", {
        exact: true,
      }),
  ).toBeVisible();
  await host.goto(editor);
  await host
    .getByLabel("Venue address", { exact: true })
    .fill("12 Dhanmondi Road, north entrance");
  await host.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(host.getByRole("status")).toContainText("Draft saved");
  await host
    .getByRole("button", { name: "Submit for review", exact: true })
    .click();
  await expect(host.getByRole("status")).toContainText("Submitted");
  await admin.reload();
  await admin
    .getByRole("button", { name: "Approve and publish", exact: true })
    .click();
  await expect(admin.getByText("published", { exact: true })).toBeVisible();
  const search =
    "/events?q=Dhaka+Unplugged&category=concert&location=Dhaka&date=2099-12-20";
  await visitor.goto(search);
  await expect(
    visitor.getByRole("heading", { name: "Dhaka Unplugged", exact: true }),
  ).toBeVisible();
  await expect(
    visitor.getByText("From BDT 500", { exact: true }),
  ).toBeVisible();
  await visitor
    .getByRole("link")
    .filter({
      has: visitor.getByRole("heading", {
        name: "Dhaka Unplugged",
        exact: true,
      }),
    })
    .click();
  await expect(visitor).toHaveURL(/\/events\/event-[0-9a-f-]+$/);
  const detail = visitor.url();
  await visitor.reload();
  await expect(
    visitor.getByRole("heading", { name: "Dhaka Unplugged", exact: true }),
  ).toBeVisible();
  await expect(visitor.getByText(/General Admission · BDT 500/)).toBeVisible();
  await expect(
    visitor.getByText("12 Dhanmondi Road, north entrance, Dhaka", {
      exact: true,
    }),
  ).toBeVisible();
  await visitor.screenshot({
    path: "test-results/division2-detail-desktop.png",
    fullPage: true,
  });
  await visitor.setViewportSize({ width: 390, height: 844 });
  expect(
    await visitor.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await visitor.screenshot({
    path: "test-results/division2-detail-mobile.png",
    fullPage: true,
  });
  expect((await request.get(`/api/event-posters/${id}`)).status()).toBe(200);
  const publicResult = await request.get(
    `/api/events/${detail.split("/").pop()}`,
  );
  expect(publicResult.status()).toBe(200);
  expect(JSON.stringify(await publicResult.json())).not.toContain(
    "north entrance.",
  );
  const { db: customer } = await loginEventUser("customer"),
    { db: other } = await loginEventUser("other");
  const token = (await customer.auth.getSession()).data.session!.access_token,
    otherToken = (await other.auth.getSession()).data.session!.access_token;
  expect(
    (
      await request.post("/api/host/events", {
        headers: { Authorization: `Bearer ${token}` },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.get(`/api/host/events/${id}`, {
        headers: { Authorization: `Bearer ${otherToken}` },
      })
    ).status(),
  ).toBe(404);
  await host.goto(editor);
  await expect(host.getByText(/Saving any changes/)).toBeVisible();
  expect((await request.get(detail)).status()).toBe(200);
  await host
    .getByLabel("Event title", { exact: true })
    .fill("Dhaka Unplugged revised");
  await host.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(host.getByRole("status")).toContainText("Draft saved");
  await visitor.goto(search);
  await expect(
    visitor.getByRole("heading", { name: "No events found", exact: true }),
  ).toBeVisible();
  // Next.js may already have streamed HTTP 200 from the parent loading boundary.
  // Assert the unavailable screen and no leaked content; APIs must return 404.
  await visitor.goto(detail);
  await expect(
    visitor.getByRole("heading", { name: "Event unavailable", exact: true }),
  ).toBeVisible();
  await expect(visitor.getByText(/General Admission/)).toHaveCount(0);
  expect(
    (await request.get(`/api/events/${detail.split("/").pop()}`)).status(),
  ).toBe(404);
  expect((await request.get(`/api/event-posters/${id}`)).status()).toBe(404);
  await hostContext.close();
  await adminContext.close();
  await visitorContext.close();
});
