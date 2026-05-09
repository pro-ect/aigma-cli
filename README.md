# aigma

[![npm version](https://img.shields.io/npm/v/aigma.svg)](https://www.npmjs.com/package/aigma)
[![npm downloads](https://img.shields.io/npm/dm/aigma.svg)](https://www.npmjs.com/package/aigma)
[![license](https://img.shields.io/npm/l/aigma.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/aigma.svg)](https://www.npmjs.com/package/aigma)

Generate connected canvas nodes on [Aigma](https://aigma.co) from your terminal — for designers, developers, and AI agents.

```bash
npm install -g aigma
aigma login
aigma create-node --prompt "Hero section for an AI photo editor"
```

That call:
1. Generates a self-contained HTML fragment with Gemini 3.1 Pro (taste skill on by default).
2. Publishes it to a public `https://aigma.co/p/{slug}` URL.
3. Adds a connected dataflow on your canvas at `/nodes`: **Prompt → HTML Output**, with an **Image Bucket** if you attach `--asset`s. Click **Run** in the canvas to regenerate from the prompt anytime.

## Why aigma CLI

- **Build canvas pages from a script.** Same model + taste skill as the web app, so output looks consistent whether you click Run or run a command.
- **Agent-friendly.** Stable JSON output (`--json`), structured exit codes, an `aigma agent-help` integration guide, and a device-code login flow for managed agents that have no browser.
- **Asset-aware.** Drop in images, PDFs, text files (`--asset ./file`); the server describes images, extracts PDF text, and hands the model real URLs to embed.
- **Forking, never mutating.** `copy-node`, `re-create`, `--from-node` all produce a NEW node so iterations stack up next to each other on the canvas.

## Install

```bash
npm install -g aigma     # global
# or
npx aigma --help          # one-off
```

Requires Node.js 18.17+.

## Quick start

```bash
# 1. Sign in via your browser (Google or Apple)
aigma login

# 2. (Optional) Pin a default canvas so you stop typing UUIDs
aigma list-canvases
aigma config set default-canvas "My Project"

# 3. Generate
aigma create-node --prompt "Hero section for an AI photo editor"
```

## Common workflows

```bash
# List + inspect
aigma list-canvases                  # all canvases
aigma describe-canvas "My Project"   # frames + node count
aigma list-nodes                     # frames on the default canvas (TSV)

# Create
aigma create-canvas --name "Project Falcon"
aigma create-node --prompt "Pricing table" --canvas "Project Falcon"

# Long prompts: --prompt-file or stdin
aigma create-node --prompt-file ./brief.md --canvas "Project Falcon"
cat brief.md | aigma create-node --canvas "Project Falcon"

# Attach assets — uploads + builds an Image Bucket node connected to the HTML
aigma create-node --prompt "Personal site" --asset ./photo.jpg --asset ./resume.pdf

# Or upload separately and reference URLs yourself
URL=$(aigma upload-asset ./logo.svg)
aigma create-node --prompt "Header with our logo: $URL"

# Iterate without losing the original — every flow forks to a NEW node
aigma copy-node <node-id>                                       # pure duplicate
aigma re-create --node <node-id> --prompt "darker palette"      # regen from HTML
aigma create-node --from-node <node-id> --prompt-file edit.md   # same, advanced

# Agent one-shot — canvas is auto-resolved from the prompt
aigma do "Hero for our SaaS Landing project"

# Output / scripting
aigma create-node --prompt "Footer with links" --output footer.html
aigma create-node --prompt "Footer with links" --json | jq
```

## For AI agents

The CLI ships with an integration guide aimed at AI agents (Claude Code, custom managed agents, Telegram-bot frontends, etc.):

```bash
aigma agent-help        # prints AGENTS.md to stdout
```

Three auth paths:

| Use case | Command |
|---|---|
| Local dev (Claude Code, your laptop) | `aigma login` (browser loopback) |
| Hosted bot / managed agent (no browser on the agent's host) | `aigma login --device` (humans) or `aigma device-start` + `aigma device-poll <code>` (bots) |
| CI / cron | `AIGMA_TOKEN=$(aigma export-token)` (paste into env) |

Full details in [AGENTS.md](./AGENTS.md).

## Output rules

| Stream | Content |
|---|---|
| **stdout** | JSON only when `--json` is passed; pipe-safe (`aigma … --json \| jq`) |
| **stderr** | Human-readable progress, status, and errors |

| Exit code | Meaning |
|---|---|
| `0` | success |
| `1` | generic failure |
| `2` | validation error (bad/missing args) |
| `3` | auth required — run `aigma login` |

## Configuration

CLI talks to production Aigma by default. Override via env to target a different deployment:

```bash
export AIGMA_SUPABASE_URL=https://your-project.supabase.co
export AIGMA_SUPABASE_ANON_KEY=...
export AIGMA_WEB_BASE=https://your-app.example.com
```

Credentials are stored at `~/.aigma/credentials.json` (mode 0600). When `AIGMA_TOKEN` is set, the CLI reads the env var instead and skips disk writes — useful for read-only managed-agent runtimes.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## License

MIT — see [LICENSE](./LICENSE).
