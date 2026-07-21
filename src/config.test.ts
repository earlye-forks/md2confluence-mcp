import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { resolveConfluenceToken } from "./config.js";

const TEST_PASS_ENTRY = "md2confluence-mcp-test/api-token";
const DUMMY_TOKEN = "dummy-test-token-12345";

before(() => {
  execFileSync("pass", ["insert", "-m", "-f", TEST_PASS_ENTRY], {
    input: DUMMY_TOKEN,
  });
});

after(() => {
  execFileSync("pass", ["rm", "-f", TEST_PASS_ENTRY]);
});

test("resolveConfluenceToken reads the token from pass when env var is unset", async () => {
  const token = await resolveConfluenceToken({
    CONFLUENCE_TOKEN_PASS_ENTRY: TEST_PASS_ENTRY,
  } as NodeJS.ProcessEnv);
  assert.equal(token, DUMMY_TOKEN);
});

test("resolveConfluenceToken returns the env var override without consulting pass", async () => {
  const token = await resolveConfluenceToken({
    CONFLUENCE_TOKEN: "env-override-token",
    CONFLUENCE_TOKEN_PASS_ENTRY: "md2confluence-mcp-test/does-not-exist",
  } as NodeJS.ProcessEnv);
  assert.equal(token, "env-override-token");
});
