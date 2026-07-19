/**
 * Tiny .env.local upsert helpers (no dotenv dependency required).
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export function envFilePath(name = '.env.local'): string {
  return resolve(process.cwd(), name);
}

export function readEnvFile(path: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!existsSync(path)) return map;
  const text = readFileSync(path, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map.set(key, value);
  }
  return map;
}

export function upsertEnvVars(
  path: string,
  updates: Record<string, string>,
  options?: { createIfMissing?: boolean }
): void {
  const create = options?.createIfMissing !== false;
  if (!existsSync(path) && !create) {
    throw new Error(`Env file not found: ${path}`);
  }

  let lines: string[] = existsSync(path) ? readFileSync(path, 'utf8').split(/\r?\n/) : [];
  if (lines.length === 1 && lines[0] === '') lines = [];

  const remaining = new Map(Object.entries(updates));

  lines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;
    const eq = trimmed.indexOf('=');
    if (eq === -1) return line;
    const key = trimmed.slice(0, eq).trim();
    if (!remaining.has(key)) return line;
    const value = remaining.get(key)!;
    remaining.delete(key);
    return `${key}=${value}`;
  });

  for (const [key, value] of remaining) {
    lines.push(`${key}=${value}`);
  }

  // Ensure trailing newline
  const body = lines.join('\n').replace(/\n*$/, '\n');
  writeFileSync(path, body, 'utf8');
}

export function loadDotEnvLocal(): void {
  const path = envFilePath();
  if (!existsSync(path)) return;
  const map = readEnvFile(path);
  for (const [k, v] of map) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
}
