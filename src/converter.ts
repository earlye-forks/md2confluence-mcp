/**
 * Markdown to Confluence converter
 * - Converts Markdown to Confluence storage format
 * - Renders Mermaid diagrams to PNG locally via @mermaid-js/mermaid-cli
 */

import { marked } from "marked";
import { createHash } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const execFileAsync = promisify(execFile);

interface Attachment {
  filename: string;
  data: Buffer;
}

interface ConversionResult {
  html: string;
  attachments: Attachment[];
}

/**
 * Render Mermaid diagram to PNG locally using `mmdc` (mermaid-cli) via npx.
 * Mermaid's parser mishandles a literal `#` immediately followed by digits
 * inside note/label text (e.g. `#29380` in `Note over X: ...`); this is a
 * pre-existing Mermaid limitation, not something to "fix" by escaping `#`.
 */
async function renderMermaidToPng(code: string): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "mermaid-"));
  const inputPath = join(dir, "diagram.mmd");
  const outputPath = join(dir, "diagram.png");

  try {
    await writeFile(inputPath, code, "utf-8");
    await execFileAsync("npx", [
      "-y",
      "-p",
      "@mermaid-js/mermaid-cli",
      "mmdc",
      "-i",
      inputPath,
      "-o",
      outputPath,
      "-b",
      "white",
    ]);
    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Generate filename from content hash
 */
function generateFilename(content: string): string {
  const hash = createHash("md5").update(content).digest("hex").slice(0, 12);
  return `mermaid-${hash}.png`;
}

/**
 * Convert Markdown to Confluence storage format
 */
export async function convertMarkdownToConfluence(
  markdown: string
): Promise<ConversionResult> {
  const attachments: Attachment[] = [];
  const mermaidBlocks: Map<string, string> = new Map();

  // Extract and process Mermaid blocks
  const mermaidRegex = /```mermaid\n([\s\S]*?)```/g;
  let match;
  let processedMarkdown = markdown;

  while ((match = mermaidRegex.exec(markdown)) !== null) {
    const mermaidCode = match[1].trim();
    const filename = generateFilename(mermaidCode);

    // Render to PNG
    try {
      const pngData = await renderMermaidToPng(mermaidCode);
      attachments.push({ filename, data: pngData });

      // Replace with Confluence image macro
      const placeholder = `![mermaid-${filename}](${filename})`;
      mermaidBlocks.set(match[0], placeholder);
    } catch (error) {
      console.error(`Failed to render Mermaid diagram: ${error}`);
      // Keep original code block on error
    }
  }

  // Replace Mermaid blocks with image placeholders
  for (const [original, replacement] of mermaidBlocks) {
    processedMarkdown = processedMarkdown.replace(original, replacement);
  }

  // Configure marked for Confluence-compatible output
  marked.setOptions({
    gfm: true,
    breaks: false,
  });

  // Custom renderer for Confluence
  const renderer = new marked.Renderer();

  // Code blocks -> Confluence code macro
  renderer.code = (code: string, language?: string) => {
    const lang = language || "text";
    return `<ac:structured-macro ac:name="code">
      <ac:parameter ac:name="language">${lang}</ac:parameter>
      <ac:parameter ac:name="collapse">false</ac:parameter>
      <ac:plain-text-body><![CDATA[${code}]]></ac:plain-text-body>
    </ac:structured-macro>`;
  };

  // Images -> Confluence attachment or external image
  renderer.image = (href: string, title: string | null, text: string) => {
    // Check if it's an attachment (Mermaid image)
    if (href.endsWith(".png") && href.startsWith("mermaid-")) {
      return `<ac:image><ri:attachment ri:filename="${href}"/></ac:image>`;
    }

    // External image
    return `<ac:image><ri:url ri:value="${href}"/></ac:image>`;
  };

  // Links
  renderer.link = (href: string, title: string | null, text: string) => {
    return `<a href="${href}">${text}</a>`;
  };

  marked.use({ renderer });

  // Convert Markdown to HTML
  let html = marked.parse(processedMarkdown) as string;

  // Clean up whitespace in macros
  html = html.replace(/>\s+</g, "><");

  return { html, attachments };
}

/**
 * Remove YAML front matter from Markdown
 */
export function removeFrontMatter(markdown: string): string {
  return markdown.replace(/^---\n[\s\S]*?\n---\n/, "");
}

/**
 * Extract title from front matter or first heading
 */
export function extractTitle(markdown: string, fallback: string = "Untitled"): string {
  // Try front matter
  const frontMatterMatch = markdown.match(/^---\n[\s\S]*?title:\s*["']?([^"'\n]+)["']?/);
  if (frontMatterMatch) {
    return frontMatterMatch[1].trim();
  }

  // Try first H1
  const h1Match = markdown.match(/^#\s+(.+)$/m);
  if (h1Match) {
    return h1Match[1].trim();
  }

  return fallback;
}
