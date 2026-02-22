import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { ConductorConfig } from './types.js';

const CONFIG_DIR = path.join(os.homedir(), '.conductor');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

function resolveHome(filePath: string): string {
  if (filePath.startsWith('~/') || filePath === '~') {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return filePath;
}

function defaultConfig(): ConductorConfig {
  return {
    projects: [],
    claudeHome: '~/.claude',
    server: {
      port: 4444,
    },
    notifications: {
      macOS: true,
      browser: true,
    },
  };
}

export function loadConfig(): ConductorConfig {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      // Create config directory and default config
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
      const defaults = defaultConfig();
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaults, null, 2), 'utf-8');
      console.log(`[config] Created default config at ${CONFIG_PATH}`);
      return resolveConfig(defaults);
    }

    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<ConductorConfig>;

    // Merge with defaults for missing fields
    const defaults = defaultConfig();
    const config: ConductorConfig = {
      projects: parsed.projects ?? defaults.projects,
      claudeHome: parsed.claudeHome ?? defaults.claudeHome,
      server: {
        port: parsed.server?.port ?? defaults.server.port,
      },
      notifications: {
        macOS: parsed.notifications?.macOS ?? defaults.notifications.macOS,
        browser: parsed.notifications?.browser ?? defaults.notifications.browser,
      },
    };

    return resolveConfig(config);
  } catch (err) {
    console.error(`[config] Error loading config from ${CONFIG_PATH}, using defaults:`, err);
    return resolveConfig(defaultConfig());
  }
}

export function saveConfig(config: ConductorConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

function resolveConfig(config: ConductorConfig): ConductorConfig {
  return {
    ...config,
    claudeHome: resolveHome(config.claudeHome),
    projects: config.projects.map((p) => ({
      ...p,
      path: resolveHome(p.path),
    })),
  };
}
