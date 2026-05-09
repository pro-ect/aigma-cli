# aigma — Agent Integration Guide

> **v0.1.16** `aigma create-node` now uses the same generator the web app's
> Run button uses: full HTML document output, thinking-model reasoning
> enabled, no token cap. Every call produces a connected React-Flow graph
> on the canvas: a Prompt node → N HTMLOutput nodes, plus an ImageBucket
> node when you attach `--asset` files.

This file is for AI agents using the `aigma` CLI. If you are an agent and just installed `aigma`, read this end-to-end before issuing other commands.

Run `aigma agent-help` at any time to print this document.

---

## ⚠️ Check the CLI is up to date (do this once per session)

`aigma` is a thin client over an evolving server. Bug fixes and new features (improved generator, new asset metadata, new flags) ship as npm releases — but globally-installed npm packages do NOT auto-update. If the user installed `aigma` weeks ago, they're running stale behavior silently.

Before your first `create-node` of a session, compare versions and act:

```bash
INSTALLED=$(aigma --version 2>/dev/null)
LATEST=$(npm view aigma version 2>/dev/null)
if [ -n "$LATEST" ] && [ "$INSTALLED" != "$LATEST" ]; then
  echo "aigma $LATEST is available (you have $INSTALLED)"
fi
```

Decision tree if a newer version exists:

1. **You have permission to run `npm install -g`** → upgrade silently and continue:
   ```bash
   npm install -g aigma@latest
   ```
   Print one line to the user: *"upgraded aigma to 0.1.20"*. Don't ask before doing this — it's a routine maintenance step, not a destructive action.

2. **`aigma` was installed via Homebrew** (`which aigma` returns `/opt/homebrew/...`) → `npm install -g` won't help. Tell the user: *"aigma 0.1.20 is available — run `brew upgrade aigma`"*.

3. **You can't install globally** (sandbox blocks `npm -g`, no network, etc.) → surface the message and the exact command, then continue with the older version. Don't refuse to do the work over a version skew.

4. **`npm view` failed** (offline, registry down) → silently skip the check, continue. Never block the user's request because the version probe couldn't reach npm.

This costs ~500 ms once per session. Cheap insurance against shipping bugs we already fixed.

---

## ⚠️ IMPORTANT — How to write prompts (read this first)

The model behind `aigma create-node` is a thinking model. It designs the page structure, sections, and visual decisions on its own — that's its strength. **Your job as an agent is to give it content and intent, not a blueprint.**

**DO**

- Pass the user's *content* as-is (App Store description, brand brief, bio, copy block, product details).
- State *intent* in one short sentence ("editorial minimal CV site", "premium beauty/wellness landing page", "playful bookstore homepage").
- Attach assets via `--asset` and let the system handle them. **Do not describe the assets in your prompt text** — the server inspects each asset, generates a description, and wires it into the model call automatically. Mentioning "Asset 1 is the icon, Asset 2 is the screenshot" duplicates work and crowds the budget.

**DON'T**

- Outline sections like *"1. Hero with headline. 2. Features grid with 3 cards. 3. Pricing table…"* — the model will skip its own thinking and produce stiff, formulaic output.
- Tell the model *"use Asset 1 as the logo, use Asset 2 in the hero"* — wired in automatically.
- Pad the prompt with style rules (fonts, palette, shadows). A taste skill is enforced server-side; it'll fight your overrides anyway.

**Good — terse + intent**

```
build a cv web site editorial minimal style
```

**Good — content-rich, no structure prescribed**

```
Oval AI marketing landing page

Scan your face in seconds. Oval AI maps wrinkles, acne, dark spots & pores —
then tracks your progress week by week.

[paste full App Store description / brand brief here]
```

**Bad — structural blueprint** (suppresses the model's thinking)

```
Build a responsive landing page. Sections in order:
1. Hero with headline + CTA "Download on the App Store"
2. What it analyzes — 6 metrics in a grid
3. How it works — 3 steps
4. Pricing comparison table…
```

Why this matters: the CLI generator is now identical to what the web app's "Run" button uses (full-document HTML, reasoning enabled, no token cap). With a terse content-rich prompt, you get the same rich output a user gets when they hit Run on a prompt node in the canvas. A structural blueprint actively defeats that.

---

## What `aigma` does

`aigma` lets you create HTML "nodes" on a user's Aigma canvas from the command line. Each call to `aigma create-node`:

1. Generates a complete self-contained HTML document from your prompt.
2. Publishes it to a public URL: `https://aigma.co/p/{slug}`.
3. Drops the result onto the user's canvas as a connected Prompt → HTMLOutput pair (plus an ImageBucket node when assets are attached). The user sees it within ~5s of opening that canvas in the web app.

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

### Researching and downloading real assets

When the user asks for a site about a real person, app, product, or brand,
**don't ship picsum placeholders** — go find the real assets and pass them
through `--asset`. The model already gets a description of each asset and
embeds the bucket URL in the output (no hotlinking to third-party hosts).

Useful sources, with notes on what's safe to use:

- **People / personal sites** — when the site is *about a person*, always
  try to find a public photo of them. A real headshot in the hero
  transforms the page from "anonymous bio" to "this is them". Check
  (in order): GitHub avatar (`https://github.com/<handle>.png?size=512`),
  the person's own website (look for `<img>` in the hero, OG image, or
  `/about`), Twitter/X profile picture, LinkedIn public photo, Dribbble
  avatar, conference speaker pages. Save as `<name>-headshot.jpg` or
  `<name>-portrait.jpg` so the design model knows it's a person photo.
  If you can't find one, that's fine — say so to the user, don't fabricate
  with picsum.
- **App Store apps** — the public iTunes Search API returns the icon and
  some metadata. Screenshots come from the page HTML.
  ```bash
  curl -s "https://itunes.apple.com/lookup?id=<numeric-app-id>" \
    | jq -r '.results[0].artworkUrl512' \
    | xargs -I {} curl -sLo /tmp/icon.jpg "{}"
  ```
- **Public brand sites / press kits** — fetch logos, hero images, product
  shots from the brand's own site or `/press` page. Brand assets the
  business publishes for press are explicitly meant for reuse in coverage
  and partner sites.
- **The user's own files** — always preferred. If the user mentions a logo
  on their site or a screenshot in their repo, ask before downloading from
  random web sources.

Rules:

- **Name the file descriptively before passing it to `--asset`.** The
  filename is forwarded to the design model as `[Asset: <filename>]` and
  it carries intent better than any Flash description. Use the pattern
  `<subject>-<role>.<ext>` — e.g. `oval-ai-app-icon.jpg`,
  `oval-ai-screenshot-skin-report.png`, `acme-logo-mark.svg`,
  `evgenii-headshot.jpg`. Avoid generic names like `image.jpg` or
  `download.png`.
- Save into `/tmp/aigma-*` (or `mktemp`). Don't pollute the repo.
- Bucket cap is 25 MB per file — resize before upload if needed (use `sips`
  on macOS or `convert` from ImageMagick).
- One asset per `--asset` flag, repeatable. Pass the local path; the CLI
  uploads it for you and preserves the filename.
- If a download 404s or hangs, skip that asset and continue — don't fail
  the whole generation over one missing file.
- Be conservative with copyright. Don't grab random Google-image-search
  results. Stick to first-party sources (the brand's own site, App Store,
  GitHub repos the user owns) or assets the user pasted into the chat.

Worked example — portfolio site for an iOS developer with their app icons.
Note the descriptive filenames (`<app-slug>-app-icon.jpg`): the design model
sees `[Asset: oval-ai-app-icon.jpg]` and immediately knows what it is.

```bash
# Look up each app's icon via iTunes Search API and save with a descriptive name
declare -A apps=(
  [6761716668]="oval-ai"
  [6755970618]="aya-ai-lab"
  [6749643317]="ezra"
)
for id in "${!apps[@]}"; do
  slug="${apps[$id]}"
  url=$(curl -s "https://itunes.apple.com/lookup?id=$id" \
    | jq -r '.results[0].artworkUrl512')
  curl -sLo "/tmp/aigma-${slug}-app-icon.jpg" "$url"
done

# Hand them to aigma alongside the prompt — model gets filename + dimensions
# + Flash description, embeds real icons (not picsum)
aigma create-node --canvas <id> --prompt-file /tmp/portfolio.md \
  --asset /tmp/aigma-oval-ai-app-icon.jpg \
  --asset /tmp/aigma-aya-ai-lab-app-icon.jpg \
  --asset /tmp/aigma-ezra-app-icon.jpg
```

The server inspects each image and the bucket block sent to the design model
looks like:

```
[Asset: oval-ai-app-icon.jpg]
URL: https://...storage.../oval-ai-app-icon.jpg
Type: image/jpeg · 512×512 (square) · 57 KB
Description: <Gemini Flash description of the icon>
```

So the model has three layers of signal at once: the descriptive filename
("app-icon"), the dimensions + aspect hint ("512×512 square"), and the
Flash description. That's enough to render it as a small rounded icon
rather than a generic photo.

### Assets — let `--asset` do the work

Prompt is text-only (max 4000 chars). **Do NOT base64-encode images into the
prompt** — it will be truncated and the model can't render it anyway. Use
`--asset`:

```bash
aigma create-node --canvas <id> -p "premium skincare app landing page" \
  --asset ./icon.png --asset ./screenshot.png
```

What happens under the hood (this matches the web app's Run flow exactly):

1. Each file is uploaded to the user's asset bucket (stable public URL).
2. The server fetches each one, runs it through Gemini Flash to produce a
   developer-grade description (visual content, colors, text, layout), and
   adds an `=== ASSETS FROM BUCKET ===` block to the prompt.
3. The asset URLs are wired into a single `ImageBucket` node on the canvas,
   connected to the generated HTMLOutput. The model is instructed to embed
   the EXACT URLs (`<img src="https://…">`) in the output — not picsum
   placeholders.

You don't need to mention the assets in your prompt text. The server already
ensures the model sees them. Repeat `--asset` for each file. Anything fits —
images, PDFs, audio, video, text, JSON. Bucket is public-read, 25 MB per
upload.

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
  "html": "<!DOCTYPE html><html>...</html>",
  "slug": "abc1234",
  "public_url": "https://aigma.co/p/abc1234",
  "canvas_url": "https://aigma.co/nodes?canvas=uuid",
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

- Prompt is capped at 4000 characters. (If you're getting close, your prompt is probably too prescriptive — see the IMPORTANT block above.)
- Output is a complete `<!DOCTYPE html>` document, rendered inside a 1280×800 frame on the canvas. Scripts and Google Fonts via `@import` are allowed — same as the web Run flow.
- Token usage is metered against the user's Aigma plan. A 429 means they hit their limit; surface that to the user.

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
