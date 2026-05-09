# Changelog

All notable changes to the `aigma` CLI. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.14] — 2026-05-09

### Added
- `aigma create-node --variants <N>` (alias `-n`) — generate **N parallel takes** of the same prompt (1–5). The server fans out N OpenRouter calls in parallel and lays them out as one Prompt node connected to N HTML Output nodes stacked vertically on the canvas.
- With `--output <file>`, multiple variants write indexed files (`output.1.html`, `output.2.html`, …).
- Per-variant URLs printed as `[1/N] https://aigma.co/p/<slug>`. Failed variants reported individually; the run still succeeds as long as at least one variant returned.

## [0.1.13] — 2026-05-09

### Added
- `aigma create-node --model <id>` (alias `-m`) — choose any allowed OpenRouter model id for a single run.
- `aigma list-models` — print the supported model catalog (id, label, provider, default).
- `aigma config set default-model <id>` — persist a per-machine default.

### Changed
- Single source of truth for the model catalog: `packages/shared/models.ts` mirrored to `supabase/functions/_shared/models.ts`. Web and edge functions both import from one place.

## [0.1.11] — 2026-05-09

### Changed
- `aigma create-node --asset` now sends a clean prompt + structured `assets[]` payload. The Prompt node on the canvas no longer contains the URL list — it only holds the user's prompt text.
- The server builds an **ImageBucket** node (single bucket containing all assets) connected to the HTML Output node, mirroring the web's `/nodes` mental model.
- Asset describe / PDF extract pipeline runs server-side via the same OpenRouter model + system prompts the web uses.
- Taste directives no longer force-substitute `picsum.photos`; when assets are provided, the model embeds the real asset URLs.

## [0.1.10] — 2026-05-09

### Added
- Device-code login (`aigma login --device`, `aigma device-start`, `aigma device-poll <code>`) — sign in from a managed agent / chat bot frontend without a local browser.
- Web route `/cli-link` for users to authorize device-code logins.

## [0.1.9] — 2026-05-08

### Added
- `aigma export-token` — print a base64 session for the `AIGMA_TOKEN` env var (managed-agent auth).
- Web `/nodes` realtime: changes from the CLI appear within ~1s on an open canvas with a toast.

### Changed
- Edge functions use a Postgres RPC (`cli_append_to_graph`) for atomic appends — no more race against the web's saveGraph.
- CLI reads `AIGMA_TOKEN` env var before falling back to `~/.aigma/credentials.json`.

## [0.1.8] — 2026-05-08

### Changed
- **Pivot to `node_graphs`**: the CLI now writes into the `/nodes` view (the only canvas surface the product exposes today). `list-canvases`, `create-canvas`, `describe-canvas`, `create-node`, `clone-node` all read/write `node_graphs`.
- Each `create-node` produces a connected dataflow on the canvas: PromptCreator → HTMLOutput, with one Image node per `--asset`.
- Removed the legacy `cli_node_drafts` polling on the web side.

## [0.1.7] — 2026-05-08

### Added
- `aigma copy-node <id>` — pure HTML duplicate (no LLM call); always forks to a new node.
- `aigma create-node --from-node <id>` — regenerate from an existing node's HTML as starting context.
- `aigma re-create --node <id> --prompt "..."` — sugar over `--from-node`.
- `aigma list-assets`, `aigma delete-asset <key>`.
- `aigma do "<request>"` — agent one-shot: picks/creates a canvas, then runs `create-node`.

## [0.1.6] — 2026-05-08

### Added
- `aigma upload-asset <file>` — upload any file (images, PDFs, audio, video, text up to 25 MB).
- `aigma create-node --asset <file>` (repeatable) — auto-uploads and references uploaded assets.
- `aigma create-node --prompt-file <path>` and stdin support — handle long prompts without shell-escaping.

## [0.1.5] — 2026-05-08

### Added
- `aigma config get/set/unset` for `default-canvas`.
- `aigma list-nodes` — TSV listing of frames on a canvas.
- Stderr progress lines during `create-node`.

## [0.1.4] — 2026-05-08

### Added
- `aigma open` — open `/nodes` in the browser; `--published <slug>` and `--draft <id>` deep-link variants.

### Changed
- Smarter frame names from prompts (first sentence, max 60 chars).
- `describe-canvas` dedupes rootIds.
- Auto-publish workflow rebases against `origin/main` to avoid concurrent-version collisions.

## [0.1.3] — 2026-05-08

### Added
- `aigma describe-canvas <id|name>` — frames + node count for one canvas.
- `aigma whoami` — show the currently signed-in user.

### Changed
- `aigma --version` reads from `package.json` instead of being hard-coded.
- All commands surface the server's `detail` field on errors.

## [0.1.2] — 2026-05-08

### Added
- Canvas selection: `aigma list-canvases`, `aigma create-canvas --name "..."`, `aigma create-node --canvas <id|name>`.
- `AGENTS.md` integration guide, surfaced via `aigma agent-help`.

## [0.1.1] — 2026-05-08

### Added
- First public release: `aigma login` (browser loopback OAuth via Supabase) and `aigma create-node --prompt "..."`.

[0.1.11]: https://www.npmjs.com/package/aigma/v/0.1.11
[0.1.10]: https://www.npmjs.com/package/aigma/v/0.1.10
[0.1.9]: https://www.npmjs.com/package/aigma/v/0.1.9
[0.1.8]: https://www.npmjs.com/package/aigma/v/0.1.8
[0.1.7]: https://www.npmjs.com/package/aigma/v/0.1.7
[0.1.6]: https://www.npmjs.com/package/aigma/v/0.1.6
[0.1.5]: https://www.npmjs.com/package/aigma/v/0.1.5
[0.1.4]: https://www.npmjs.com/package/aigma/v/0.1.4
[0.1.3]: https://www.npmjs.com/package/aigma/v/0.1.3
[0.1.2]: https://www.npmjs.com/package/aigma/v/0.1.2
[0.1.1]: https://www.npmjs.com/package/aigma/v/0.1.1
