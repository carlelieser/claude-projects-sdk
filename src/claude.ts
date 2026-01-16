import {EventEmitter} from 'node:events';
import {spawn, ChildProcess} from 'node:child_process';
import {createInterface, Interface} from 'node:readline';
import {
    ClaudeStreamMessageSchema,
    ClaudeOptions,
    ClaudeStreamMessage,
    ClaudeResponse,
} from './common/schemas';

interface PendingQuery {
    resolve: (response: ClaudeResponse) => void;
    reject: (error: Error) => void;
    messages: ClaudeStreamMessage[];
    text: string;
}

export interface ClaudeEvents {
    ready: [];
    message: [ClaudeStreamMessage];
    response: [ClaudeResponse];
    error: [Error];
    exit: [number | null, NodeJS.Signals | null];
}

export type {ClaudeOptions, ClaudeStreamMessage, ClaudeResponse};

export class Claude extends EventEmitter<ClaudeEvents> {
    private process: ChildProcess | null = null;
    private readline: Interface | null = null;
    private _sessionId: string | null = null;
    private pendingQuery: PendingQuery | null = null;

    readonly cwd: string;
    readonly options: ClaudeOptions;

    private constructor(options: ClaudeOptions = {}) {
        super();
        this.options = options;
        this.cwd = options.cwd ?? process.cwd();
    }

    get sessionId(): string | null {
        return this._sessionId;
    }

    get isRunning(): boolean {
        return this.process !== null && this.process.exitCode === null;
    }

    ready(): Promise<this> {
        if (this._sessionId) {
            return Promise.resolve(this);
        }

        return new Promise((resolve) => {
            this.once('ready', () => resolve(this));
        });
    }

    static async spawn(options: ClaudeOptions = {}): Promise<Claude> {
        const claude = new Claude(options);
        claude.start();
        await claude.ready();
        return claude;
    }

    private start(): void {
        const args = this.buildArgs();

        this.process = spawn('claude', args, {
            cwd: this.cwd,
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        if (!this.process.stdout || !this.process.stdin) {
            throw new Error('Failed to create process streams');
        }

        this.readline = createInterface({
            input: this.process.stdout,
            crlfDelay: Infinity,
        });

        this.readline.on('line', (line) => {
            this.handleLine(line);
        });

        this.process.stdout.once('data', () => {
            this.emit('ready');
        });

        this.process.stderr?.on('data', (data: Buffer) => {
            const message = data.toString().trim();
            if (message) {
                this.emit('error', new Error(message));
            }
        });

        this.process.on('error', (error) => {
            this.emit('error', error);
        });

        this.process.on('exit', (code, signal) => {
            this.process = null;
            this.readline?.close();
            this.readline = null;

            if (this.pendingQuery) {
                this.pendingQuery.reject(new Error(`Process exited with code ${code}`));
                this.pendingQuery = null;
            }

            this.emit('exit', code, signal);
        });
    }

    private buildArgs(): string[] {
        const args: string[] = [
            '-p',
            '--input-format',
            'stream-json',
            '--output-format',
            'stream-json',
            '--verbose',
        ];

        if (this.options.model) {
            args.push('--model', this.options.model);
        }

        if (this.options.allowedTools) {
            for (const tool of this.options.allowedTools) {
                args.push('--allowedTools', tool);
            }
        }

        if (this.options.systemPrompt) {
            args.push('--system-prompt', this.options.systemPrompt);
        }

        if (this.options.dangerouslySkipPermissions) {
            args.push('--dangerously-skip-permissions');
        }

        if (this.options.sessionId) {
            args.push('--session-id', this.options.sessionId);
        }

        if (this.options.resume) {
            args.push('--resume', this.options.sessionId ?? '');
        }

        if (this.options.args) {
            args.push(...this.options.args);
        }

        return args;
    }

    private handleLine(line: string): void {
        if (!line.trim()) return;

        let parsed: unknown;
        try {
            parsed = JSON.parse(line);
        } catch {
            return;
        }

        const result = ClaudeStreamMessageSchema.safeParse(parsed);
        if (!result.success) {
            return;
        }

        const message = result.data;

        this._sessionId = message.session_id ?? null;

        this.emit('message', message);

        if (this.pendingQuery) {
            this.pendingQuery.messages.push(message);

            if (message.type === 'assistant' && message.message?.content) {
                const content = message.message.content;
                if (Array.isArray(content)) {
                    for (const block of content) {
                        if (block.type === 'text' && block.text) {
                            this.pendingQuery.text += block.text;
                        }
                    }
                }
            }

            if (message.type === 'result') {
                const response: ClaudeResponse = {
                    sessionId: this._sessionId ?? '',
                    messages: this.pendingQuery.messages,
                    text: this.pendingQuery.text,
                    result: message,
                };
                this.pendingQuery.resolve(response);
                this.pendingQuery = null;
                this.emit('response', response);
            }
        }
    }

    private writeMessage(prompt: string): void {
        if (!this.isRunning || !this.process?.stdin) {
            throw new Error('Claude process is not running');
        }

        const message = JSON.stringify({
            type: 'user',
            message: {
                role: 'user',
                content: prompt,
            },
        });

        this.process.stdin.write(message + '\n');
    }

    async query(prompt: string): Promise<ClaudeResponse> {
        if (this.pendingQuery) {
            throw new Error('A query is already in progress');
        }

        return new Promise((resolve, reject) => {
            this.pendingQuery = {
                resolve,
                reject,
                messages: [],
                text: '',
            };

            try {
                this.writeMessage(prompt);
            } catch (error) {
                this.pendingQuery = null;
                reject(error);
            }
        });
    }

    kill(): void {
        if (this.process) {
            this.process.kill();
        }
    }

    async close(): Promise<void> {
        if (!this.isRunning) {
            return;
        }

        return new Promise((resolve) => {
            this.once('exit', () => {
                resolve();
            });

            this.process?.stdin?.end();
        });
    }
}
