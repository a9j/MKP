/**
 * The site URL, which every absolute link on the site is built from.
 *
 * A variable set to an empty string used to reach new URL("") and fail the
 * whole build with "Invalid URL" and no indication of which variable was at
 * fault. These assertions are cheap and that failure was expensive.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { env } from "../src/lib/env";

function withEnv<T>(values: Record<string, string | undefined>, run: () => T): T {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(values)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("a configured site URL is used as given, without a trailing slash", () => {
  withEnv({ NEXT_PUBLIC_SITE_URL: "https://monakproject.org/" }, () => {
    assert.equal(env.siteUrl, "https://monakproject.org");
  });
});

test("an empty site URL is treated as unset, not as a URL", () => {
  for (const empty of ["", "   "]) {
    withEnv({ NEXT_PUBLIC_SITE_URL: empty, VERCEL_URL: undefined }, () => {
      assert.equal(env.siteUrl, "http://localhost:3000");
      assert.doesNotThrow(() => new URL(env.siteUrl));
    });
  }
});

test("a deployment with nothing configured describes itself, not localhost", () => {
  withEnv({ NEXT_PUBLIC_SITE_URL: "", VERCEL_URL: "mkp-git-branch.vercel.app" }, () => {
    assert.equal(env.siteUrl, "https://mkp-git-branch.vercel.app");
  });
});

test("whatever the environment, the site URL parses", () => {
  const cases = [
    { NEXT_PUBLIC_SITE_URL: undefined, VERCEL_URL: undefined },
    { NEXT_PUBLIC_SITE_URL: "", VERCEL_URL: "" },
    { NEXT_PUBLIC_SITE_URL: "https://monakproject.org", VERCEL_URL: "x.vercel.app" },
  ];
  for (const values of cases) {
    withEnv(values, () => {
      assert.doesNotThrow(() => new URL(env.siteUrl), JSON.stringify(values));
    });
  }
});
