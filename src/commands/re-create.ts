import { runCreateNode } from './create-node.js';

interface ReCreateOptions {
  node: string;
  prompt?: string;
  promptFile?: string;
  canvas?: string;
  asset?: string[];
  output?: string;
  json?: boolean;
}

export async function runReCreate(opts: ReCreateOptions): Promise<void> {
  // Sugar over create-node with from_node set. The result is always a
  // NEW node (forking, never mutation).
  await runCreateNode({
    prompt: opts.prompt,
    promptFile: opts.promptFile,
    canvas: opts.canvas,
    asset: opts.asset,
    output: opts.output,
    json: opts.json,
    fromNode: opts.node,
  });
}
