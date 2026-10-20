// Test-only SDK egress guard. A mistaken real Auth URL fails the app process,
// even when application error handling would otherwise hide the fetch failure.
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if ((url.hostname.endsWith(".supabase.co") || /\/(auth|rest|storage)\/v1(?:\/|$)/.test(url.pathname)) &&
      url.origin !== "http://127.0.0.1:54321") {
    console.error("E2E blocked unexpected Supabase network request");
    process.exitCode = 1;
    setImmediate(() => process.exit(1));
    return Promise.reject(new Error("E2E Supabase egress denied"));
  }
  return originalFetch(input, init);
};
