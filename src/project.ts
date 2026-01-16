import path, { basename } from 'node:path';
import { readdir } from 'node:fs/promises';
import fg from 'fast-glob';
import { Session } from './session';
import { Conversation } from './conversation';
import { PATTERNS, PATHS } from './common/constants';

export class Project {
    readonly path: string;
    readonly name: string;
    readonly claudeDir: string;

    constructor(path: string, claudeDir: string) {
        this.path = path;
        this.name = basename(path);
        this.claudeDir = claudeDir;
    }

    async loadSessions(): Promise<Session[]> {
        const entries = await fg(PATTERNS.UUID_JSONL, {
            cwd: this.claudeDir,
            absolute: true,
        });

        const conversations = await Promise.all(
            entries.map((source) => Conversation.create(source))
        );

        const mainConversations = conversations.filter((conv) => !conv.isSidechain);

        return mainConversations.map((conv) => new Session(conv, this.claudeDir));
    }

    static async getProjectDirs(claudeHome: string): Promise<string[]> {
        const projectsDir = path.resolve(claudeHome, PATHS.PROJECTS_DIR);

        try {
            const entries = await readdir(projectsDir, { withFileTypes: true });
            return entries
                .filter((e) => e.isDirectory())
                .map((e) => path.join(projectsDir, e.name));
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return [];
            }
            throw new Error(`Failed to read projects directory: ${projectsDir}`, { cause: error });
        }
    }
}
