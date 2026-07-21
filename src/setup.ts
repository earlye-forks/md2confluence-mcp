#!/usr/bin/env node

import { execFile } from "child_process";
import { promisify } from "util";
import { createInterface } from "node:readline/promises";

const execFileAsync = promisify(execFile);

interface EntrySpec {
  entry: string;
  prompt: string;
  hint?: string;
}

const ENTRIES: EntrySpec[] = [
  {
    entry: "confluence/url",
    prompt: "Confluence base URL (e.g. https://your-domain.atlassian.net/wiki): ",
  },
  {
    entry: "confluence/email",
    prompt: "Atlassian account email: ",
  },
  {
    entry: "confluence/api-token",
    prompt: "Confluence API token (get one at https://id.atlassian.com/manage/api-tokens): ",
    hint: "Note: this prompt does not mask input.",
  },
];

async function passIsAvailable(): Promise<boolean> {
  try {
    await execFileAsync("which", ["pass"]);
    return true;
  } catch {
    return false;
  }
}

async function passEntryExists(entry: string): Promise<boolean> {
  try {
    await execFileAsync("pass", ["show", entry]);
    return true;
  } catch {
    return false;
  }
}

async function passInsert(entry: string, value: string): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = execFile("pass", ["insert", "-m", "-f", entry], (error) => {
      if (error) {
        reject(error);
      } else {
        resolvePromise();
      }
    });
    child.stdin!.end(value);
  });
}

async function claudeIsAvailable(): Promise<boolean> {
  try {
    await execFileAsync("which", ["claude"]);
    return true;
  } catch {
    return false;
  }
}

function manualRegisterHint(repoRoot: string): string {
  return `  claude mcp add confluence --scope user -- npm --prefix ${repoRoot} run start`;
}

async function registerWithClaudeCode(): Promise<void> {
  console.log("");

  if (!(await claudeIsAvailable())) {
    console.log("`claude` CLI not found on $PATH — skipping Claude Code MCP registration.");
    return;
  }

  const repoRoot = process.cwd();

  try {
    await execFileAsync("claude", [
      "mcp",
      "add",
      "confluence",
      "--scope",
      "user",
      "--",
      "npm",
      "--prefix",
      repoRoot,
      "run",
      "start",
    ]);
  } catch {
    console.log("⚠️  `claude mcp add` failed. Register manually with:");
    console.log(manualRegisterHint(repoRoot));
    return;
  }

  // `claude mcp add` can report success and still not have actually
  // written the registration (e.g. a sandboxed config write that's
  // silently rejected), so verify by reading it back rather than
  // trusting the command's exit/stdout.
  try {
    await execFileAsync("claude", ["mcp", "get", "confluence"]);
    console.log("Registered `confluence` MCP server with Claude Code (scope: user).");
  } catch {
    console.log("⚠️  Could not verify registration via `claude mcp get confluence`. Register manually with:");
    console.log(manualRegisterHint(repoRoot));
  }
}

async function main() {
  if (!(await passIsAvailable())) {
    console.error("`pass` was not found on $PATH.");
    console.error("");
    console.error("Install it (https://www.passwordstore.org/) and initialize it with:");
    console.error("  pass init <your-gpg-id>");
    console.error("");
    console.error("Then re-run this setup.");
    process.exit(1);
  }

  const existing = new Map<string, boolean>();
  for (const spec of ENTRIES) {
    existing.set(spec.entry, await passEntryExists(spec.entry));
  }

  const missing = ENTRIES.filter((spec) => !existing.get(spec.entry));

  if (missing.length === 0) {
    console.log("All Confluence credentials are already configured in `pass`:");
    for (const spec of ENTRIES) {
      console.log(`  - ${spec.entry}`);
    }
  } else {
    console.log("Setting up md2confluence-mcp credentials in `pass`.");
    console.log("");

    const created: string[] = [];

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      for (const spec of missing) {
        if (spec.hint) {
          console.log(spec.hint);
        }
        const value = await rl.question(spec.prompt);
        await passInsert(spec.entry, value);
        created.push(spec.entry);
      }
    } finally {
      rl.close();
    }

    console.log("");
    console.log("Setup complete:");
    for (const spec of ENTRIES) {
      const status = created.includes(spec.entry) ? "created" : "already present";
      console.log(`  - ${spec.entry}: ${status}`);
    }
  }

  await registerWithClaudeCode();
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
