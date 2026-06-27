import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

let fallbackEnv: Record<string, string> | null = null;

function parseEnvFile(content: string) {
  const values: Record<string, string> = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    values[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }

  return values;
}

function readFallbackEnv() {
  if (fallbackEnv) return fallbackEnv;

  const candidates = [
    path.join(process.cwd(), '.env.local'),
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'scripts/.env'),
  ];

  fallbackEnv = {};
  for (const filePath of candidates) {
    if (existsSync(filePath)) {
      fallbackEnv = { ...fallbackEnv, ...parseEnvFile(readFileSync(filePath, 'utf8')) };
    }
  }

  return fallbackEnv;
}

export function serverEnv(name: string) {
  return process.env[name] ?? readFallbackEnv()[name];
}
