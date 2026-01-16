import fg from 'fast-glob';
import { rm } from 'node:fs/promises';
import { Conversation } from './conversation';
import { PATTERNS } from './common/constants';

export class Session {
    readonly claudeDir: string;
    private _conversation: Conversation;
    private _projectPath: string | null = null;
    private _sidechains: Conversation[] | null = null;
    private _version: string | null = null;
    private _startedAt: string | null = null;
    private _gitBranch: string | null = null;

    constructor(conversation: Conversation, claudeDir: string) {
        this._conversation = conversation;
        this.claudeDir = claudeDir;
    }

    get id(): string | null {
        return this._conversation.sessionId;
    }

    get conversation(): Conversation {
        return this._conversation;
    }

    get projectPath(): string | null {
        return this._projectPath;
    }

    get version(): string | null {
        return this._version;
    }

    get startedAt(): string | null {
        return this._startedAt;
    }

    get gitBranch(): string | null {
        return this._gitBranch;
    }

    loadMetadata(): void {
        const message = this._conversation
            .getMessages()
            .find((msg) => msg.type === 'user' || msg.type === 'assistant');

        if (!message) {
            return;
        }

        this._projectPath = message.cwd;
        this._version = message.version ?? null;
        this._startedAt = message.timestamp ?? null;
        this._gitBranch = message.gitBranch ?? null;
    }

    async loadSidechains(): Promise<void> {
        if (this._sidechains !== null) {
            return;
        }

        const sessionId = this.id;

        if (!sessionId) {
            this._sidechains = [];
            return;
        }

        const entries = await fg(PATTERNS.AGENT_JSONL, {
            cwd: this.claudeDir,
            absolute: true,
        });

        const conversations = await Promise.all(
            entries.map((source) => Conversation.create(source))
        );

        this._sidechains = conversations.filter((conv) => conv.sessionId === sessionId);
    }

    getSidechains(): readonly Conversation[] {
        if (this._sidechains === null) {
            throw new Error('Sidechains not loaded. Call loadSidechains() first.');
        }
        return [...this._sidechains];
    }

    static create(conversation: Conversation, claudeDir: string): Session {
        const session = new Session(conversation, claudeDir);
        session.loadMetadata();
        return session;
    }

    static async getById(id: string, claudeDir: string): Promise<Session | null> {
        const mainEntries = await fg(PATTERNS.UUID_JSONL, {
            cwd: claudeDir,
            absolute: true,
        });

        for (const entry of mainEntries) {
            const conversation = await Conversation.create(entry);
            if (conversation.sessionId === id) {
                return Session.create(conversation, claudeDir);
            }
        }

        return null;
    }

    async delete(): Promise<void> {
        await this.loadSidechains();
        const sidechains = this.getSidechains();

        const deletePromises = sidechains.map((sidechain) => rm(sidechain.source, { force: true }));
        deletePromises.push(rm(this._conversation.source, { force: true }));

        await Promise.all(deletePromises);
    }
}
