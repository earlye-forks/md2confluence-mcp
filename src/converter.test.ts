import { test } from "node:test";
import assert from "node:assert/strict";
import { extractTitle, removeFrontMatter } from "./converter.js";

test("removeFrontMatter strips YAML front matter", () => {
  const markdown = "---\ntitle: Hello\n---\n# Hello\n\nBody text";
  assert.equal(removeFrontMatter(markdown), "# Hello\n\nBody text");
});

test("removeFrontMatter leaves markdown without front matter unchanged", () => {
  const markdown = "# Hello\n\nBody text";
  assert.equal(removeFrontMatter(markdown), markdown);
});

test("extractTitle reads title from front matter", () => {
  const markdown = '---\ntitle: "My Title"\n---\n# Other Heading';
  assert.equal(extractTitle(markdown), "My Title");
});

test("extractTitle falls back to first H1 when no front matter title", () => {
  const markdown = "# My Heading\n\nBody text";
  assert.equal(extractTitle(markdown), "My Heading");
});

test("extractTitle falls back to provided default when nothing found", () => {
  const markdown = "Body text with no heading";
  assert.equal(extractTitle(markdown, "Fallback"), "Fallback");
});
