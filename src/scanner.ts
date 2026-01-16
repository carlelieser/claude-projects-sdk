import path from 'node:path';
import fg from 'fast-glob';
import { Project } from './project';
import { Session } from './session';
import { Conversation } from './conversation';
import { getDefaultClaudeHome, PATTERNS } from './common/constants';

export class Scanner {
    private readonly cwd: string;

    constructor(cwd?: string) {
        this.cwd = cwd ?? getDefaultClaudeHome();
    }

    private async loadProject(claudeDir: string): Promise<Project | null> {
        const files = await fg(PATTERNS.ANY_JSONL, { cwd: claudeDir, absolute: true });

        if (!files[0]) return null;

        const conversation = await Conversation.create(files[0]);
        const session = Session.create(conversation, path.dirname(files[0]));

        return session.project;
    }

    async scan(): Promise<Project[]> {
        const dirs = await Project.getProjectDirs(this.cwd);
        const promises = dirs.map((dir) => this.loadProject(dir));
        const results = await Promise.all(promises);
        return results.filter((project) => !!project);
    }
}
