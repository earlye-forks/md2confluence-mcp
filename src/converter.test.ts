import { test } from "node:test";
import assert from "node:assert/strict";
import { convertMarkdownToConfluence, extractTitle, removeFrontMatter } from "./converter.js";

const PNG_MAGIC_NUMBER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

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

test(
  "convertMarkdownToConfluence renders a mermaid block to a PNG attachment",
  { timeout: 120_000 },
  async () => {
    const markdown = "# Title\n\n```mermaid\nflowchart LR\n  A --> B\n```\n";
    const result = await convertMarkdownToConfluence(markdown);

    assert.equal(result.attachments.length, 1);
    assert.deepEqual(
      result.attachments[0].data.subarray(0, 8),
      PNG_MAGIC_NUMBER
    );
  }
);
