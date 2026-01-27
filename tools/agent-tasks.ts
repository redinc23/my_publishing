/**
 * GitHub AI Agent Task Runner (safe-by-default)
 *
 * Usage:
 *   npx tsx tools/agent-tasks.ts list
 *   npx tsx tools/agent-tasks.ts show <taskId>
 *   npx tsx tools/agent-tasks.ts run <taskId> [--dry-run] [--allow-risky]
 *
 * What it does:
 * - Runs predefined tasks (commands + acceptance checklist).
 * - Blocks high-risk tasks unless explicitly allowed.
 * - Prints PR checklist + evidence hints every run.
 * 
 * Execution behavior:
 * - Commands within a task run sequentially (one at a time).
 * - Post-commands run after all task commands complete.
 * - Commands are executed via shell (bash/sh).
 * 
 * Security:
 * - Commands are read from agent-tasks.json configuration.
 * - Ensure agent-tasks.json is protected and reviewed before modifications.
 */

import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

type Risk = "low" | "medium" | "high";

type Task = {
  id: string;
  title: string;
  risk: Risk;
  description: string;
  commands: string[];
  acceptance: string[];
};

type Catalog = {
  version: number;
  defaults: {
    postCommands: string[];
  };
  tasks: Task[];
};

const ROOT = process.cwd();
const CATALOG_PATH = path.join(ROOT, "agent-tasks.json");

function die(msg: string): never {
  process.stderr.write(`\nError: ${msg}\n`);
  process.exit(1);
}

function loadCatalog(): Catalog {
  if (!existsSync(CATALOG_PATH)) {
    die(`Missing ${CATALOG_PATH}. See AGENT_TASKS.md for documentation or create agent-tasks.json with version, defaults.postCommands, and tasks array.`);
  }
  const raw = readFileSync(CATALOG_PATH, "utf8");
  let json: Catalog;
  
  try {
    json = JSON.parse(raw) as Catalog;
  } catch (e) {
    die(`Invalid JSON syntax in ${CATALOG_PATH}: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!json.version || !json.defaults?.postCommands || !Array.isArray(json.tasks)) {
    die(`Invalid catalog schema in agent-tasks.json`);
  }

  for (const t of json.tasks) {
    if (!t.id || !t.title || !t.risk || !Array.isArray(t.commands) || !Array.isArray(t.acceptance)) {
      die(`Invalid task entry in agent-tasks.json: ${JSON.stringify(t)}`);
    }
    if (!["low", "medium", "high"].includes(t.risk)) {
      die(`Invalid risk level "${t.risk}" for task ${t.id}. Must be: low, medium, or high`);
    }
  }

  return json;
}

function runCmd(cmd: string, opts: { dryRun: boolean }): Promise<void> {
  return new Promise((resolve, reject) => {
    if (opts.dryRun) {
      process.stdout.write(`[dry-run] ${cmd}\n`);
      return resolve();
    }

    process.stdout.write(`\n$ ${cmd}\n`);
    const child = spawn(cmd, {
      stdio: "inherit",
      shell: true,
      cwd: ROOT,
      env: process.env,
    });

    child.on("error", (error) => {
      reject(new Error(`Failed to execute command: ${error.message}`));
    });

    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed (${code}): ${cmd}`));
    });
  });
}

function usage(): void {
  process.stdout.write(`
GitHub AI Agent Tasks (safe-by-default)

Commands:
  list
  show <taskId>
  run <taskId> [--dry-run] [--allow-risky]

Examples:
  npx tsx tools/agent-tasks.ts list
  npx tsx tools/agent-tasks.ts show quickstart:format
  npx tsx tools/agent-tasks.ts run quickstart:format --dry-run
  npx tsx tools/agent-tasks.ts run deps:update --allow-risky

`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const [cmd, taskId, ...rest] = args;

  const dryRun = rest.includes("--dry-run");
  const allowRisky = rest.includes("--allow-risky");

  if (!cmd) {
    usage();
    return;
  }

  const catalog = loadCatalog();

  if (cmd === "list") {
    process.stdout.write(`Catalog v${catalog.version}\n`);
    for (const t of catalog.tasks) {
      process.stdout.write(`- ${t.id} [${t.risk}] ${t.title}\n`);
    }
    return;
  }

  if (cmd === "show") {
    if (!taskId) die(`Missing taskId`);
    const t = catalog.tasks.find((x) => x.id === taskId);
    if (!t) die(`Unknown taskId: ${taskId}`);

    process.stdout.write(`\n${t.id} [risk=${t.risk}]\n${t.title}\n${t.description}\n`);
    process.stdout.write(`\nCommands:\n`);
    for (const c of t.commands) process.stdout.write(`- ${c}\n`);
    process.stdout.write(`\nAcceptance:\n`);
    for (const a of t.acceptance) process.stdout.write(`- [ ] ${a}\n`);
    return;
  }

  if (cmd === "run") {
    if (!taskId) die(`Missing taskId`);
    const t = catalog.tasks.find((x) => x.id === taskId);
    if (!t) die(`Unknown taskId: ${taskId}`);

    if (t.risk === "high" && !allowRisky) {
      die(`Task "${t.id}" is high risk. Re-run with --allow-risky if intentional.`);
    }

    for (const c of t.commands) await runCmd(c, { dryRun });
    for (const c of catalog.defaults.postCommands) await runCmd(c, { dryRun });

    process.stdout.write(`\nDone: ${t.id}\n`);
    process.stdout.write(`\nPR Checklist:\n`);
    for (const a of t.acceptance) process.stdout.write(`- [ ] ${a}\n`);
    process.stdout.write(`\nEvidence:\n- Paste outputs of commands above into PR description (or link CI).\n`);
    return;
  }

  usage();
}

main().catch((err) => {
  process.stderr.write(`\n${String(err)}\n`);
  process.exit(1);
});
