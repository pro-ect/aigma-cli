# aigma — Agent Integration Guide

> **v0.1.8** Aigma's CLI now writes directly to the `/nodes` view. Every
> `create-node` call produces a connected React-Flow graph: a PromptCreator
> node (with your prompt) → an HTMLOutput node (with the generated HTML),
> plus an ImageNode for each `--asset` you attach. The user sees this
> structure visually on their canvas.

This file is for AI agents using the `aigma` CLI. If you are an agent and just installed `aigma`, read this end-to-end before issuing other commands.

Run `aigma agent-help` at any time to print this document.

## What `aigma` does

`aigma` lets you create HTML "nodes" on a user's Aigma canvas from the command line. Each call to `aigma create-node`:

1. Generates a self-contained HTML fragment from your prompt.
2. Publishes it to a public URL: `https://aigma.co/p/{slug}`.
3. Drops a draft node onto the user's canvas. The user sees it within ~5s of opening that canvas in the web app.

A user can have **multiple canvases** (think of them as separate projects). You should usually target a specific canvas; otherwise the draft lands on the user's most-recently-edited canvas.

## Authentication

`aigma login` is interactive (opens a browser). Two ways an agent can have credentials:

### Option 1 — local agent (Claude Code, etc.)

The user runs `aigma login` once on the machine. Credentials live at `~/.aigma/credentials.json`. The agent inherits them automatically.

### Option 2 — managed agent / chat-bot frontend (device-code flow)

When the agent runs in the cloud or in a chat surface (Telegram, Slack, etc.) and the user can tap a link from their phone but can't run a terminal, use the **device-code flow**. No tokens to paste, no env-var dance.

**Bot loop:**
```bash
# 1. mint a code + URL, send to the user in chat
aigma device-start --json
# {"ok":true,"code":"5HAP-RY7E","url":"https://aigma.co/cli-link?code=5HAP-RY7E","expires_in":600}

# 2. poll until the user approves (every ~3s)
aigma device-poll 5HAP-RY7E --json
# {"ok":false,"status":"pending"}     ← keep polling
# {"ok":true,"status":"approved","user":{"id":"…","email":"…"}}

# 3. once approved, creds are saved automatically — the same process can
#    immediately run `aigma create-node ...` etc.
```

The user side: tap the URL, sign in if needed, click **Authorize**. Codes expire after 10 minutes. They are single-use — after one successful poll the row is marked consumed.

**Interactive `--device` (humans):**
```bash
aigma login --device
# prints URL + code, opens browser, polls automatically until approved
```

### Option 3 — `AIGMA_TOKEN` env var (CI / scripts)

Pre-baked credential for non-interactive runs where there is no human in the loop at all (CI, cron jobs):

```bash
# user, on their local machine:
aigma login
aigma export-token
# copy the printed value, set it as AIGMA_TOKEN in your CI's secrets
```

When `AIGMA_TOKEN` is set, the CLI:
- Skips reading `~/.aigma/credentials.json`
- Auto-refreshes the access_token in memory (no disk writes)
- Treats the token's user as the actor

If `aigma create-node` exits with code `3` ("Not authenticated"), bubble that up to the user — they need to refresh `AIGMA_TOKEN` (run `aigma export-token` again on their machine).

## Recommended workflow

```
1. aigma whoami --json                       # confirm auth
2. aigma list-canvases --json                # see all canvases (names only)
3. aigma describe-canvas <id> --json         # frames + node count for the
                                             # ones you're considering
4. Choose / create a canvas (see below)
5. (Optional) aigma upload-asset <file>      # ONE upload-asset per file you
                                             # want to appear in the HTML.
                                             # Or use create-node --asset to
                                             # do uploads inline.
6. aigma create-node --prompt "..." --canvas <id> --json [--asset file ...]
```

### Assets — ALWAYS upload first

The CLI's prompt is text-only (max 4000 chars). **Do NOT base64-encode images
or other binary content into the prompt** — it will be truncated and the
model can't render it anyway. Instead:

1. Upload each file with `aigma upload-asset <file>` → returns a stable
   public URL.
2. Either pass the URL into your prompt directly, or use
   `aigma create-node --asset <file>` (repeatable). With `--asset`, the CLI
   uploads each file and appends a structured `AVAILABLE ASSETS` block to
   your prompt; the model embeds the URLs in the generated HTML
   (`<img src=…>`, `<video src=…>`, etc.) so the asset is visually part of
   the page on the canvas.

Anything fits — images, PDFs, audio, video, text, JSON. The bucket is
public-read and capped at 25 MB per upload.

### Step 1 — list canvases

```bash
aigma list-canvases --json
```

Returns lightweight metadata (no frame extraction — the list endpoint is intentionally cheap):

```json
{
  "ok": true,
  "canvases": [
    {
      "id": "uuid",
      "name": "SaaS Landing",
      "created_at": "2026-04-01T...",
      "updated_at": "2026-05-08T...",
      "node_count": null,
      "frames": []
    }
  ]
}
```

For frames + counts on a specific canvas, call `describe-canvas`:

```bash
aigma describe-canvas <uuid-or-exact-name> --json
```

Returns:

```json
{
  "ok": true,
  "canvas": {
    "id": "uuid",
    "name": "SaaS Landing",
    "node_count": 12,
    "frames": [
      { "id": "uuid", "name": "Hero section", "type": "webframe" },
      { "id": "uuid", "name": "Pricing table", "type": "webframe" }
    ]
  }
}
```

Use `frames[].name` (AI-generated descriptive names) plus the canvas `name` to judge what's already there. Only call `describe-canvas` for the 1–3 candidates that look most relevant — it loads the canvas's full document, so don't loop it across all canvases.

### Step 2 — pick or create a canvas

Decision rule:

- If the user's task clearly refers to an existing project and one canvas's `name` or `frames[].name` matches, use that canvas's `id`.
- If nothing fits, or the user is starting something new, create a canvas:

```bash
aigma create-canvas --name "Landing v2" --json
```

Response:

```json
{
  "ok": true,
  "canvas": { "id": "uuid", "name": "Landing v2", ... }
}
```

Use the returned `id` for the next step.

### Step 3 — create the node

```bash
aigma create-node \
  --prompt "Hero section for an AI photo editor with two CTAs and product screenshot" \
  --canvas <uuid> \
  --json
```

Response:

```json
{
  "ok": true,
  "node_id": "uuid",
  "draft_id": "uuid",
  "html": "<section>...</section>",
  "slug": "abc1234",
  "public_url": "https://aigma.co/p/abc1234",
  "canvas_url": "https://aigma.co/nodes?draft=uuid",
  "canvas": { "id": "uuid", "name": "Landing v2" }
}
```

The user can immediately:
- Visit `public_url` to see the rendered page.
- Open the canvas (`canvas_url` deep-links to it) and the WebFrame appears within ~5s.

## --canvas argument

You can pass either:
- A UUID: `--canvas 0f6e2b1a-...`
- An exact (case-insensitive) name: `--canvas "SaaS Landing"`

If a name matches multiple canvases, the server returns HTTP 400 with a `matches` array — re-issue the call with one of the listed UUIDs.

If `--canvas` is omitted entirely, the server defaults to the user's most-recently-updated canvas. Prefer being explicit.

## Output discipline

| Stream | Content |
|---|---|
| stdout | JSON only when `--json` is passed. Pipe-safe (`aigma … --json \| jq`). |
| stderr | Human-readable progress and errors. |

Always use `--json` when scripting.

## Exit codes

| Code | Meaning | Recovery |
|---|---|---|
| 0 | Success | continue |
| 1 | Generic failure | inspect stderr / `error` field in JSON |
| 2 | Validation error (missing/bad args) | fix args |
| 3 | Auth required | tell the user to run `aigma login` |

## Iteration

You can call `create-node` repeatedly — every call creates a new node, so variations sit side-by-side on the canvas. To replace a node you don't want, the user can delete it manually in the web app (no CLI delete command in v0.2).

## Constraints worth knowing

- Prompt is capped at 4000 characters.
- The HTML fragment is rendered inside a 1280×800 frame on the canvas. Don't include `<html>`, `<head>`, or `<body>` wrappers — the model is instructed to avoid them but you can mention "single self-contained block" in your prompt for safety.
- No `<script>` tags will be generated.
- Token usage is metered against the user's Aigma plan. A 429 means they hit their limit.

## Configuration

Override defaults via env (rarely needed):

```bash
AIGMA_SUPABASE_URL=...
AIGMA_SUPABASE_ANON_KEY=...
AIGMA_WEB_BASE=...
```

## Long prompts — `--prompt-file` or stdin

For prompts beyond a couple of sentences, prefer `--prompt-file <path>` (or
piping via stdin) over `--prompt "..."` in shell. Avoids quoting bugs with
backticks/quotes in the prompt:

```bash
aigma create-node --prompt-file ./brief.md --canvas <id> --json
cat brief.md | aigma create-node --canvas <id> --json
```

## Iteration: never mutate, always fork

Aigma's design contract is forking, not editing. To "improve" an existing
node, copy it (or regenerate from it) — that produces a NEW node id and
keeps the original untouched. Three flavors:

```bash
# Pure copy — no LLM call, just duplicates the HTML to a new node
aigma copy-node <id> [--canvas <c>] --json

# Regenerate from source HTML + a new instruction (forks)
aigma re-create --node <id> --prompt "make it darker, swap CTA copy" \
  --canvas <c> --json

# Same effect via create-node, useful for richer flag combos
aigma create-node --from-node <id> \
  --prompt-file ./change.md --asset ./new-logo.svg \
  --canvas <c> --json
```

The result is always a new draft / new public slug / new canvas frame.

## One-shot for agents

When you want the canvas selection handled for you:

```bash
aigma do "Pricing section for the SaaS Landing project" --json
```

`aigma do`:
1. Lists your canvases.
2. Naive keyword match between prompt tokens and canvas-name tokens.
3. If a canvas name shares words with the prompt → uses it.
4. Otherwise creates a new canvas (name derived from the prompt).
5. Calls `create-node` against the chosen canvas.

Use `do` for unattended runs; use the explicit `list-canvases` / `describe-canvas`
/ `create-node --canvas` flow when you need precision.

## Quickref

```bash
aigma login                                    # interactive — user only
aigma whoami --json                            # exit code 3 if not signed in
aigma list-canvases --json
aigma describe-canvas <id-or-name> --json
aigma list-nodes --canvas <id> --json
aigma create-canvas --name "Project" --json

# Assets — upload first, then reference
aigma upload-asset ./photo.jpg                 # prints the URL
aigma list-assets --json                       # everything you've uploaded
aigma delete-asset <key>                       # cleanup

# Generation
aigma create-node --asset ./photo.jpg --prompt "..." --canvas <id> --json
aigma create-node --from-node <id> --prompt "..." --canvas <id> --json
aigma copy-node <id> --canvas <id> --json
aigma re-create --node <id> --prompt "..." --canvas <id> --json
aigma do "<request>" --json                    # canvas auto-resolved

# Long prompts via file or pipe
aigma create-node --prompt-file ./brief.md --canvas <id> --json
cat brief.md | aigma create-node --canvas <id> --json

# Other
aigma create-node --prompt "..." --canvas <id> --output out.html
aigma config set default-canvas <id>           # skip --canvas every call
aigma open                                     # open /nodes in browser
aigma open --published <slug>                  # open /p/{slug}
aigma open --draft <id>                        # open /nodes?draft=<id>
aigma agent-help                               # print this guide
```

`aigma open` is for human follow-up — agents that need to surface a URL should print `public_url` / `canvas_url` from the `create-node` JSON response instead of shelling out to a browser.
