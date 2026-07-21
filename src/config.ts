import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const DEFAULT_TOKEN_PASS_ENTRY = "confluence/api-token";
const DEFAULT_URL_PASS_ENTRY = "confluence/url";
const DEFAULT_EMAIL_PASS_ENTRY = "confluence/email";

/**
 * Shared resolution shape for all Confluence credentials: prefer an
 * explicit env var override (no shell-out), otherwise read the named
 * `pass` entry. Missing env var, missing `pass` on $PATH, or a
 * non-zero `pass show` all resolve to "".
 */
async function resolveFromPassOrEnv(
  envVar: string | undefined,
  passEntryVar: string | undefined,
  defaultPassEntry: string
): Promise<string> {
  if (envVar) {
    return envVar;
  }

  const entry = passEntryVar || defaultPassEntry;

  try {
    const { stdout } = await execFileAsync("pass", ["show", entry]);
    return stdout.split("\n")[0].trim();
  } catch {
    return "";
  }
}

/**
 * Resolve the Confluence API token, preferring an explicit env var
 * override and falling back to the `pass` password store so the raw
 * token never has to live in a plaintext MCP server config.
 */
export async function resolveConfluenceToken(
  env: NodeJS.ProcessEnv = process.env
): Promise<string> {
  return resolveFromPassOrEnv(
    env.CONFLUENCE_TOKEN,
    env.CONFLUENCE_TOKEN_PASS_ENTRY,
    DEFAULT_TOKEN_PASS_ENTRY
  );
}

/**
 * Resolve the Confluence base URL the same way as the API token.
 */
export async function resolveConfluenceUrl(
  env: NodeJS.ProcessEnv = process.env
): Promise<string> {
  return resolveFromPassOrEnv(
    env.CONFLUENCE_URL,
    env.CONFLUENCE_URL_PASS_ENTRY,
    DEFAULT_URL_PASS_ENTRY
  );
}

/**
 * Resolve the Confluence account email the same way as the API token.
 */
export async function resolveConfluenceEmail(
  env: NodeJS.ProcessEnv = process.env
): Promise<string> {
  return resolveFromPassOrEnv(
    env.CONFLUENCE_EMAIL,
    env.CONFLUENCE_EMAIL_PASS_ENTRY,
    DEFAULT_EMAIL_PASS_ENTRY
  );
}
