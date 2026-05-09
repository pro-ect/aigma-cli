#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runLogin } from './commands/login.js';
import { runDeviceLogin, runDeviceStart, runDevicePoll } from './commands/device-login.js';
import { runCreateNode } from './commands/create-node.js';
import { runListCanvases } from './commands/list-canvases.js';
import { runCreateCanvas } from './commands/create-canvas.js';
import { runDescribeCanvas } from './commands/describe-canvas.js';
import { runListNodes } from './commands/list-nodes.js';
import { runWhoami } from './commands/whoami.js';
import { runOpen } from './commands/open.js';
import { runConfigGet, runConfigSet, runConfigUnset } from './commands/config.js';
import { runUploadAsset } from './commands/upload-asset.js';
import { runExportToken } from './commands/export-token.js';
import { runListAssets } from './commands/list-assets.js';
import { runDeleteAsset } from './commands/delete-asset.js';
import { runCopyNode } from './commands/copy-node.js';
import { runReCreate } from './commands/re-create.js';
import { runDo } from './commands/do.js';
import { runAgentHelp } from './commands/agent-help.js';
import { exitWith } from './lib/output.js';

function readVersion(): string {
  try {
    // dist/index.js → ../package.json
    const here = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'));
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const program = new Command();

program
  .name('aigma')
  .description('Aigma CLI — generate canvas nodes from your terminal')
  .version(readVersion());

program
  .command('login')
  .description('Sign in to Aigma — browser loopback by default; --device for headless / cloud agents')
  .option('--device', 'use the device-code flow instead of localhost callback (no browser on the agent\'s machine required)')
  .option('--no-open', 'with --device, do not auto-open the URL in a browser')
  .option('--json', 'output JSON on stdout')
  .action(async (opts) => {
    try {
      if (opts.device) {
        await runDeviceLogin({ json: !!opts.json, openBrowser: opts.open !== false });
      } else {
        await runLogin({ json: !!opts.json });
      }
    } catch (err) {
      exitWith(1, (err as Error).message);
    }
  });

program
  .command('device-start')
  .description('Start a device-code login: prints the URL + code, exits. Bots: send the URL to the user, then poll device-poll.')
  .option('--json', 'output JSON on stdout')
  .action(async (opts) => {
    try {
      await runDeviceStart({ json: !!opts.json });
    } catch (err) {
      exitWith(1, (err as Error).message);
    }
  });

program
  .command('device-poll')
  .description('Single poll for an in-flight device-code login; saves creds on approval.')
  .argument('<code>', 'code returned by device-start')
  .option('--json', 'output JSON on stdout')
  .action(async (code, opts) => {
    try {
      await runDevicePoll({ code, json: !!opts.json });
    } catch (err) {
      exitWith(1, (err as Error).message);
    }
  });

program
  .command('list-canvases')
  .description('List your Aigma canvases')
  .option('--json', 'output JSON on stdout')
  .action(async (opts) => {
    try {
      await runListCanvases({ json: !!opts.json });
    } catch (err) {
      exitWith(1, (err as Error).message);
    }
  });

program
  .command('create-canvas')
  .description('Create a new empty canvas')
  .requiredOption('-n, --name <name>', 'canvas name')
  .option('--json', 'output JSON on stdout')
  .action(async (opts) => {
    try {
      await runCreateCanvas({ name: opts.name, json: !!opts.json });
    } catch (err) {
      exitWith(1, (err as Error).message);
    }
  });

program
  .command('describe-canvas')
  .description('Show frames + node count for one canvas (UUID or name; defaults to config default-canvas)')
  .argument('[canvas]', 'canvas UUID or exact name')
  .option('--json', 'output JSON on stdout')
  .action(async (canvas, opts) => {
    try {
      await runDescribeCanvas({ canvas, json: !!opts.json });
    } catch (err) {
      exitWith(1, (err as Error).message);
    }
  });

program
  .command('list-nodes')
  .description('List frames on a canvas (TSV: id\\ttype\\tname; defaults to config default-canvas)')
  .option('-c, --canvas <id-or-name>', 'target canvas (UUID or exact name)')
  .option('--json', 'output JSON on stdout')
  .action(async (opts) => {
    try {
      await runListNodes({ canvas: opts.canvas, json: !!opts.json });
    } catch (err) {
      exitWith(1, (err as Error).message);
    }
  });

const config = program.command('config').description('Read or write CLI config (~/.aigma/config.json)');
config
  .command('get')
  .description('Print a config value, or all values if no key passed')
  .argument('[key]', 'config key (e.g. default-canvas)')
  .option('--json', 'output JSON on stdout')
  .action(async (key, opts) => {
    try {
      await runConfigGet({ key, json: !!opts.json });
    } catch (err) {
      exitWith(1, (err as Error).message);
    }
  });
config
  .command('set')
  .description('Set a config value')
  .argument('<key>', 'config key (e.g. default-canvas)')
  .argument('<value>', 'value to set')
  .option('--json', 'output JSON on stdout')
  .action(async (key, value, opts) => {
    try {
      await runConfigSet({ key, value, json: !!opts.json });
    } catch (err) {
      exitWith(1, (err as Error).message);
    }
  });
config
  .command('unset')
  .description('Remove a config value')
  .argument('<key>', 'config key')
  .option('--json', 'output JSON on stdout')
  .action(async (key, opts) => {
    try {
      await runConfigUnset({ key, json: !!opts.json });
    } catch (err) {
      exitWith(1, (err as Error).message);
    }
  });

program
  .command('whoami')
  .description('Show the currently signed-in user')
  .option('--json', 'output JSON on stdout')
  .action(async (opts) => {
    try {
      await runWhoami({ json: !!opts.json });
    } catch (err) {
      exitWith(1, (err as Error).message);
    }
  });

program
  .command('export-token')
  .description('Print AIGMA_TOKEN env value (base64 session) for managed agents')
  .option('--json', 'output JSON on stdout')
  .action(async (opts) => {
    try {
      await runExportToken({ json: !!opts.json });
    } catch (err) {
      exitWith(1, (err as Error).message);
    }
  });

program
  .command('open')
  .description('Open Aigma in the browser (canvas, a /p/{slug} page, or a draft deep-link)')
  .option('--published <slug>', 'open a /p/{slug} published page')
  .option('--draft <id>', 'open a /nodes?draft=<id> deep-link')
  .action(async (opts) => {
    try {
      await runOpen({ published: opts.published, draft: opts.draft });
    } catch (err) {
      exitWith(1, (err as Error).message);
    }
  });

program
  .command('upload-asset')
  .description('Upload a file to your assets bucket; prints the public URL')
  .argument('<file>', 'path to a local file')
  .option('--json', 'output JSON on stdout')
  .action(async (file, opts) => {
    try {
      await runUploadAsset({ file, json: !!opts.json });
    } catch (err) {
      exitWith(1, (err as Error).message);
    }
  });

program
  .command('list-assets')
  .description('List files you uploaded via upload-asset')
  .option('--json', 'output JSON on stdout')
  .action(async (opts) => {
    try {
      await runListAssets({ json: !!opts.json });
    } catch (err) {
      exitWith(1, (err as Error).message);
    }
  });

program
  .command('delete-asset')
  .description('Delete one of your uploaded assets by storage key')
  .argument('<key>', 'storage key (cli-uploads/<user-id>/<file>)')
  .option('--json', 'output JSON on stdout')
  .action(async (key, opts) => {
    try {
      await runDeleteAsset({ key, json: !!opts.json });
    } catch (err) {
      exitWith(1, (err as Error).message);
    }
  });

program
  .command('create-node')
  .description('Generate an HTML node from a prompt')
  .option('-p, --prompt <text>', 'prompt describing the node (required unless --prompt-file or stdin)')
  .option('-f, --prompt-file <path>', 'read the prompt from a file (handy for long prompts)')
  .option('-c, --canvas <id-or-name>', 'target canvas (UUID or exact name)')
  .option('-a, --asset <file>', 'attach a local asset (uploads first, then references it in the prompt) — repeatable', (val: string, prev: string[] = []) => [...prev, val], [])
  .option('--from-node <id>', 'use an existing node\'s HTML as the starting point (forks; never mutates the source)')
  .option('-o, --output <file>', 'write generated HTML to a file')
  .option('--json', 'output JSON on stdout')
  .action(async (opts) => {
    try {
      await runCreateNode({
        prompt: opts.prompt,
        promptFile: opts.promptFile,
        canvas: opts.canvas,
        asset: opts.asset,
        fromNode: opts.fromNode,
        output: opts.output,
        json: !!opts.json,
      });
    } catch (err) {
      exitWith(1, (err as Error).message);
    }
  });

program
  .command('copy-node')
  .description('Duplicate a node verbatim (no LLM call); produces a NEW node id and slug')
  .argument('<id>', 'source node UUID')
  .option('-c, --canvas <id-or-name>', 'target canvas (UUID or exact name)')
  .option('--json', 'output JSON on stdout')
  .action(async (id, opts) => {
    try {
      await runCopyNode({ sourceId: id, canvas: opts.canvas, json: !!opts.json });
    } catch (err) {
      exitWith(1, (err as Error).message);
    }
  });

program
  .command('re-create')
  .description('Regenerate from an existing node\'s HTML + a new prompt; produces a NEW node (never mutates the source)')
  .requiredOption('--node <id>', 'source node UUID to start from')
  .option('-p, --prompt <text>', 'instruction (what to change/keep)')
  .option('-f, --prompt-file <path>', 'read the prompt from a file')
  .option('-c, --canvas <id-or-name>', 'target canvas')
  .option('-a, --asset <file>', 'attach an asset — repeatable', (val: string, prev: string[] = []) => [...prev, val], [])
  .option('-o, --output <file>', 'write generated HTML to a file')
  .option('--json', 'output JSON on stdout')
  .action(async (opts) => {
    try {
      await runReCreate({
        node: opts.node,
        prompt: opts.prompt,
        promptFile: opts.promptFile,
        canvas: opts.canvas,
        asset: opts.asset,
        output: opts.output,
        json: !!opts.json,
      });
    } catch (err) {
      exitWith(1, (err as Error).message);
    }
  });

program
  .command('do')
  .description('Agent one-shot: pick or create a canvas based on the prompt, then generate the node')
  .argument('<prompt>', 'what you want made')
  .option('-a, --asset <file>', 'attach an asset — repeatable', (val: string, prev: string[] = []) => [...prev, val], [])
  .option('-o, --output <file>', 'write generated HTML to a file')
  .option('--json', 'output JSON on stdout')
  .action(async (prompt, opts) => {
    try {
      await runDo({
        prompt,
        asset: opts.asset,
        output: opts.output,
        json: !!opts.json,
      });
    } catch (err) {
      exitWith(1, (err as Error).message);
    }
  });

program
  .command('agent-help')
  .description('Print the AI-agent integration guide (AGENTS.md)')
  .action(async () => {
    try {
      await runAgentHelp();
    } catch (err) {
      exitWith(1, (err as Error).message);
    }
  });

program.parseAsync(process.argv).catch((err) => exitWith(1, err.message));
