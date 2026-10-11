import { expect, test, type Page } from "@playwright/test";

const appOrigin = "http://127.0.0.1:3200";
const mockOrigin = "http://127.0.0.1:54321";
const externalRequests: string[] = [];

test.beforeEach(async ({ context }) => {
  externalRequests.length = 0;
  // Observe and block browser egress; do not replace any app/Server Action responses.
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if ([appOrigin, mockOrigin].includes(url.origin)) return route.continue();
    externalRequests.push(`${route.request().method()} ${url.origin}${url.pathname}`);
    await route.abort();
  });
});

test.afterEach(async ({ request }) => {
  expect(externalRequests).toEqual([]);
  const audit = await request.get(`${mockOrigin}/__requests`);
  expect(audit.ok()).toBe(true);
  expect((await audit.json()).unexpected).toEqual([]);
});

function securityHeaders(headers: Record<string, string>) {
  for (const [name, value] of Object.entries({
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
  })) expect(headers[name]).toBe(value);
  for (const directive of ["base-uri 'self'", "frame-ancestors 'none'", "object-src 'none'"]) {
    expect(headers["content-security-policy"]).toContain(directive);
  }
  expect(headers["x-powered-by"]).toBeUndefined();
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill("e2e-user@example.com");
  await page.getByLabel("パスワード").fill("e2e-password");
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("e2e-user さん🌷")).toBeVisible();
}

async function action(page: Page, buttonName: string) {
  const responsePromise = page.waitForResponse((response) =>
    response.url() === `${appOrigin}/dashboard` &&
    response.request().method() === "POST" &&
    !!response.request().headers()["next-action"],
  );
  await page.getByRole("button", { name: buttonName, exact: true }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/x-component");
}

test("public pages, headers and HTTP authentication redirect", async ({ page, request }) => {
  const redirect = await request.get("/dashboard", { maxRedirects: 0 });
  expect(redirect.status()).toBe(307);
  expect(new URL(redirect.headers().location, redirect.url()).pathname).toBe("/login");
  securityHeaders(redirect.headers());
  for (const path of ["/login", "/privacy"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    securityHeaders(response!.headers());
    if (path === "/login") await expect(page.getByLabel("メールアドレス")).toBeVisible();
    else await expect(page.getByRole("heading", { level: 1 })).toHaveText("プライバシーとデータ");
  }
  await page.goto("/account/delete");
  await expect(page.getByRole("status")).toHaveText("現在、アカウント削除は準備中です。保存済みのデータは引き続き利用できます。");
});

test("login, tabs, unsaved draft, reload and logout", async ({ page }) => {
  await login(page);
  await page.getByRole("tab", { name: /ワーク/ }).click();
  const drafts = ["花を見つけた", "お茶がおいしかった", "よく休めた"];
  for (const [index, draft] of drafts.entries()) {
    await page.getByRole("textbox", { name: `${index + 1}つ目のよかったこと` }).fill(draft);
  }
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(localStorage.getItem("daily-affirmation:three-good-things-draft:e2e-user-id") ?? "{}"),
  )).toMatchObject({ things: drafts });
  for (const tab of [/ホーム/, /お守り/, /ワーク/]) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(page.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
  }
  for (const [index, draft] of drafts.entries()) {
    await expect(page.getByRole("textbox", { name: `${index + 1}つ目のよかったこと` })).toHaveValue(draft);
  }
  await page.reload();
  await expect(page.getByText("e2e-user さん🌷")).toBeVisible();
  await page.getByRole("tab", { name: /ワーク/ }).click();
  for (const [index, draft] of drafts.entries()) {
    await expect(page.getByRole("textbox", { name: `${index + 1}つ目のよかったこと` })).toHaveValue(draft);
  }
  await page.getByRole("button", { name: "👋 ログアウト" }).click();
  await expect(page).toHaveURL(/\/login$/);
  const redirect = await page.request.get("/dashboard", { maxRedirects: 0 });
  expect(redirect.status()).toBe(307);
  expect(new URL(redirect.headers().location, redirect.url()).pathname).toBe("/login");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

test("real production Server Actions: repeatable AI fallback and private JSON export", async ({ page, request }) => {
  await login(page);
  const baseline = (await (await request.get(`${mockOrigin}/__requests`)).json()).requests.length;
  for (let repeat = 0; repeat < 2; repeat++) {
    await action(page, "言葉を受け取る");
    await expect(page.getByRole("status").filter({ hasText: "あなたは、そのままで素晴らしい存在です。" })).toBeVisible();
    await expect(page.getByRole("button", { name: "言葉を受け取る", exact: true })).toBeEnabled();
  }
  await page.getByRole("tab", { name: /ワーク/ }).click();
  for (const input of ["少し失敗した", "今日は疲れた"]) {
    const textbox = page.getByLabel("優しい言葉に翻訳したい自分への厳しい声");
    await textbox.fill(input);
    await action(page, "優しい言葉に翻訳する 🪄");
    await expect(page.getByRole("status").filter({ hasText: "今はAIがお休み中のようです。でも、あなたが一生懸命に頑張っていることは、私がちゃんと知っていますよ。深呼吸してくださいね。" })).toBeVisible();
    await expect(textbox).toBeEnabled();
    await expect(page.getByRole("button", { name: "優しい言葉に翻訳する 🪄" })).toBeEnabled();
  }
  const before = Date.now();
  const downloadPromise = page.waitForEvent("download");
  await action(page, "データを書き出す");
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let contents = "";
  for await (const chunk of stream) contents += chunk.toString();
  const data = JSON.parse(contents);
  expect(data).toMatchObject({
    schemaVersion: 1,
    todos: [{ id: "todo-e2e", text: "深呼吸する", completed: true }],
    favoriteAffirmations: [{ id: "favorite-e2e", text: "今日も一歩ずつ" }],
    threeGoodThings: [{ id: "good-e2e", things1: "散歩", things2: "青空", things3: "温かいお茶" }],
    bloomLogs: [{ id: "bloom-e2e", flower_type: "tulip" }],
  });
  for (const key of ["todos", "favoriteAffirmations", "threeGoodThings", "bloomLogs"]) expect(data[key]).toHaveLength(1);
  const timestamp = Date.parse(data.exportedAt);
  expect(timestamp).toBeGreaterThanOrEqual(before);
  expect(timestamp).toBeLessThanOrEqual(Date.now());
  const localDate = await page.evaluate((iso) => {
    const date = new Date(iso);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }, data.exportedAt);
  expect(download.suggestedFilename()).toBe(`daily-affirmation-export-${localDate}.json`);
  expect(contents).not.toMatch(/other-user|他ユーザーの秘密|user_id|access.?token|refresh.?token|cookie|api.?key|authorization|password|anon.?key|e2e-password|e2e-user@example.com|service.?role/i);
  await expect(page.getByText("保存済みデータを書き出しました。", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "データを書き出す", exact: true })).toBeEnabled();
  const audit = await (await request.get(`${mockOrigin}/__requests`)).json();
  const serverRequests = audit.requests.slice(baseline).filter((entry: { source: string }) => entry.source === "server");
  expect(serverRequests.filter((entry: { path: string }) => entry.path === "/auth/v1/user").length).toBeGreaterThanOrEqual(5);
  for (const table of ["todos", "favorite_affirmations", "three_good_things", "bloom_logs"]) {
    expect(serverRequests).toEqual(expect.arrayContaining([expect.objectContaining({ method: "GET", path: `/rest/v1/${table}`, query: expect.stringContaining("user_id=eq.e2e-user-id") })]));
  }
});
