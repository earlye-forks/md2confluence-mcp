import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const DEFAULT_PASS_ENTRY = "confluence/api-token";

/**
 * Resolve the Confluence API token, preferring an explicit env var
 * override and falling back to the `pass` password store so the raw
 * token never has to live in a plaintext MCP server config.
 */
export async function resolveConfluenceToken(
  env: NodeJS.ProcessEnv = process.env
): Promise<string> {
  if (env.CONFLUENCE_TOKEN) {
    return env.CONFLUENCE_TOKEN;
  }

  const entry = env.CONFLUENCE_TOKEN_PASS_ENTRY || DEFAULT_PASS_ENTRY;

  try {
    const { stdout } = await execFileAsync("pass", ["show", entry]);
    return stdout.split("\n")[0].trim();
  } catch {
    return "";
  }
}
