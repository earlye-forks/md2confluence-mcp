# Fix: read CONFLUENCE_URL/CONFLUENCE_EMAIL from `pass`, add a one-time setup wizard

This prompt depends on `feature-001.md` having already run — it assumes
`src/config.ts` exports `resolveConfluenceToken` following the
env-override-then-`pass` pattern, and that `src/config.test.ts` already has
`pass insert -m -f` / `pass rm -f` fixture setup/teardown for a throwaway
test entry.

## Problem 1 — CONFLUENCE_URL/CONFLUENCE_EMAIL are still plaintext-only

`src/index.ts` reads `CONFLUENCE_URL` and `CONFLUENCE_EMAIL` directly off
`process.env` (`const CONFLUENCE_URL = process.env.CONFLUENCE_URL || ""` and
the equivalent for email), while `CONFLUENCE_TOKEN` already goes through
`resolveConfluenceToken()`'s `pass`-backed resolution from `feature-001.md`.
That's inconsistent, and it means the URL and email still have to sit in
plaintext in the MCP server config's `env` block even though the token
doesn't.

## Fix 1

Add `resolveConfluenceUrl` and `resolveConfluenceEmail` to `src/config.ts`,
following the exact same shape as `resolveConfluenceToken`:

- `export async function resolveConfluenceUrl(env: NodeJS.ProcessEnv = process.env): Promise<string>`
  — if `env.CONFLUENCE_URL` is set, return it directly (no shell-out).
  Otherwise read the `pass` entry named by `env.CONFLUENCE_URL_PASS_ENTRY`
  (default `confluence/url`) via `execFile("pass", ["show", entry])`, first
  line trimmed. Missing env var, missing `pass` on `$PATH`, or a non-zero
  `pass show` all resolve to `""`.
- `export async function resolveConfluenceEmail(env: NodeJS.ProcessEnv = process.env): Promise<string>`
  — identical shape, default pass entry `confluence/email`, override var
  `CONFLUENCE_EMAIL_PASS_ENTRY`.
- Factor the shared "env override, else `pass show <entry>`, else `\"\"`"
  logic out of all three resolvers (token/url/email) into one small private
  helper in `config.ts` (e.g. `resolveFromPassOrEnv(envVar, passEntryVar,
  defaultPassEntry, env)`) rather than copy-pasting the try/catch three
  times.
- In `src/index.ts`, replace the top-level
  `const CONFLUENCE_URL = process.env.CONFLUENCE_URL || ""` and the email
  equivalent with `await resolveConfluenceUrl()` / `await
  resolveConfluenceEmail()`, same as `CONFLUENCE_TOKEN` already does.
- Update `validateConfig()`'s error text so all three variables document the
  same shape: `pass` entry name (with its default and override env var) as
  the primary path, plaintext env var as the fallback.

## Problem 2 — no guided way to populate `pass` the first time

Once Fix 1 lands, a brand-new user has no plaintext env vars to fall back on
and probably hasn't manually run three separate `pass insert` commands
either. There's currently no walkthrough — they'd just hit the
`validateConfig()` error with no help actually resolving it.

## Design constraint this fix has to respect

The natural-sounding version of "walk the user through it" — detect missing
config inside `main()` and prompt interactively over stdin/stdout before
starting the server — **does not work here**. `StdioServerTransport` claims
stdin/stdout as the MCP JSON-RPC channel the moment the server connects;
those streams are not free to repurpose as a human terminal prompt, and by
the time `main()` runs, the MCP client (Claude Code, etc.) already launched
this process expecting protocol frames on that channel, not a prompt. So the
wizard cannot live inside `index.ts`/`main()`.

## Fix 2

Add a **separate CLI entry point** for setup, invoked manually by the user
in a real terminal — not auto-triggered by the MCP server:

- New `src/setup.ts`, compiled to `dist/setup.js`. Add a second `bin` entry
  in `package.json`: `"md2confluence-mcp-setup": "dist/setup.js"`, and a
  `"setup": "npm run build && node dist/setup.js"` script.
- Behavior:
  1. Check `pass` is on `$PATH` (e.g. `execFile("which", ["pass"])` or catch
     the ENOENT from running it). If missing, print install/init
     instructions (https://www.passwordstore.org/, `pass init <gpg-id>`) and
     exit non-zero.
  2. For each of `confluence/url`, `confluence/email`, `confluence/api-token`,
     check whether the entry already exists (`pass show <entry>` exits 0).
  3. If all three already exist, print a short "already configured" message
     and exit 0 — do not prompt, do not overwrite. This is what makes it
     safe to re-run; it's a one-time setup, not a reset command.
  4. Otherwise, using `node:readline/promises`, prompt only for the entries
     that are missing: Confluence base URL (e.g.
     `https://your-domain.atlassian.net/wiki`), Atlassian account email, and
     API token (mention https://id.atlassian.com/manage-profile/security/api-tokens
     for generating one). Note in a comment that the token prompt is not
     masked — `readline` has no built-in echo suppression, and adding a
     dependency or raw-mode TTY hack for this is out of scope here.
  5. For each newly-provided value, write it with
     `execFile("pass", ["insert", "-m", "-f", entry])`, piping the value to
     stdin (same call shape already used in `config.test.ts`'s fixture
     setup) — never build a shell string.
  6. Print a final summary of which entries were created vs. already
     present.
- In `index.ts`'s `validateConfig()`, when any of the three resolved values
  is empty, add a line pointing the user at `npm run setup` (or
  `node dist/setup.js` if installed as a dependency) as the guided fix,
  alongside the existing manual `pass insert`/env var instructions.
- README: document `npm run setup` as the recommended first-run step (before
  the existing manual "Get API Token" section), and add
  `CONFLUENCE_URL_PASS_ENTRY` / `CONFLUENCE_EMAIL_PASS_ENTRY` rows to the
  Environment Variables table next to the existing
  `CONFLUENCE_TOKEN_PASS_ENTRY` row. Drop `CONFLUENCE_URL`/`CONFLUENCE_EMAIL`
  from the Installation section's example `env` blocks now that `pass` is
  the recommended path for all three credentials (keep documenting the
  plaintext env vars as a supported fallback in the table, just not in the
  "recommended" example).

## Do not make other changes

Leave `confluence.ts`, `converter.ts`, the tool list, and Mermaid rendering
untouched. Don't change `resolveConfluenceToken`'s exported signature beyond
factoring out the shared helper. Don't remove the plaintext env var fallback
for any of the three variables — it's still the documented, supported path
for CI/non-interactive setups.

## Integration tests

- Extend `src/config.test.ts` with the same fixture pattern already used for
  the token (throwaway `pass insert -m -f <test-entry>` before, `pass rm -f`
  after — never touch the real `confluence/url`, `confluence/email`, or
  `confluence/api-token` entries in a test):
  - `resolveConfluenceUrl` reads from `pass` when `CONFLUENCE_URL` is unset
    in the passed env, using a `CONFLUENCE_URL_PASS_ENTRY` pointed at a
    throwaway test entry.
  - `resolveConfluenceUrl` returns the env var override without consulting
    `pass` (point `CONFLUENCE_URL_PASS_ENTRY` at a nonexistent entry to
    prove it).
  - Same two tests for `resolveConfluenceEmail`.
- Do not add an automated test that drives `setup.ts`'s interactive
  readline prompts or mutates the real default `pass` entries — that's
  exactly the human-in-the-loop path Fix 2 exists for. It's fine to leave
  `setup.ts` untested by `node:test`; a manual smoke run is enough.
