import * as path from 'node:path';
import * as os from 'node:os';

export const PATTERNS = {
    UUID_JSONL: './[0-9a-f]*-[0-9a-f]*-[0-9a-f]*-[0-9a-f]*-[0-9a-f]*.jsonl',
    AGENT_JSONL: './agent-*.jsonl',
    ANY_JSONL: './*.jsonl',
} as const;

export const PATHS = {
    CLAUDE_DIR: '.claude',
    PROJECTS_DIR: 'projects',
} as const;

export const getDefaultClaudeHome = () => path.resolve(os.homedir(), PATHS.CLAUDE_DIR);
