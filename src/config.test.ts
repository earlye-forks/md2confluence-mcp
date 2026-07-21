import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import {
  resolveConfluenceToken,
  resolveConfluenceUrl,
  resolveConfluenceEmail,
} from "./config.js";

const TEST_PASS_ENTRY = "md2confluence-mcp-test/api-token";
const DUMMY_TOKEN = "dummy-test-token-12345";

const TEST_URL_PASS_ENTRY = "md2confluence-mcp-test/url";
const DUMMY_URL = "https://dummy-test.atlassian.net/wiki";

const TEST_EMAIL_PASS_ENTRY = "md2confluence-mcp-test/email";
const DUMMY_EMAIL = "dummy-test@example.com";

before(() => {
  execFileSync("pass", ["insert", "-m", "-f", TEST_PASS_ENTRY], {
    input: DUMMY_TOKEN,
  });
  execFileSync("pass", ["insert", "-m", "-f", TEST_URL_PASS_ENTRY], {
    input: DUMMY_URL,
  });
  execFileSync("pass", ["insert", "-m", "-f", TEST_EMAIL_PASS_ENTRY], {
    input: DUMMY_EMAIL,
  });
});

after(() => {
  execFileSync("pass", ["rm", "-f", TEST_PASS_ENTRY]);
  execFileSync("pass", ["rm", "-f", TEST_URL_PASS_ENTRY]);
  execFileSync("pass", ["rm", "-f", TEST_EMAIL_PASS_ENTRY]);
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

test("resolveConfluenceUrl reads the url from pass when env var is unset", async () => {
  const url = await resolveConfluenceUrl({
    CONFLUENCE_URL_PASS_ENTRY: TEST_URL_PASS_ENTRY,
  } as NodeJS.ProcessEnv);
  assert.equal(url, DUMMY_URL);
});

test("resolveConfluenceUrl returns the env var override without consulting pass", async () => {
  const url = await resolveConfluenceUrl({
    CONFLUENCE_URL: "https://env-override.atlassian.net/wiki",
    CONFLUENCE_URL_PASS_ENTRY: "md2confluence-mcp-test/does-not-exist",
  } as NodeJS.ProcessEnv);
  assert.equal(url, "https://env-override.atlassian.net/wiki");
});

test("resolveConfluenceEmail reads the email from pass when env var is unset", async () => {
  const email = await resolveConfluenceEmail({
    CONFLUENCE_EMAIL_PASS_ENTRY: TEST_EMAIL_PASS_ENTRY,
  } as NodeJS.ProcessEnv);
  assert.equal(email, DUMMY_EMAIL);
});

test("resolveConfluenceEmail returns the env var override without consulting pass", async () => {
  const email = await resolveConfluenceEmail({
    CONFLUENCE_EMAIL: "env-override@example.com",
    CONFLUENCE_EMAIL_PASS_ENTRY: "md2confluence-mcp-test/does-not-exist",
  } as NodeJS.ProcessEnv);
  assert.equal(email, "env-override@example.com");
});
