import { watch } from 'node:fs';
import { stat, writeFile } from 'node:fs/promises';
import { JsonlFile } from './common/jsonl';
import { Message, MessageSchema, UserMessage, AssistantMessage } from './common/schemas';

export type ExportFormat = 'json' | 'markdown' | 'text';

export interface FilterCriteria {
    type?: 'user' | 'assistant' | 'file-history-snapshot';
    startDate?: Date;
    endDate?: Date;
}

export class Conversation extends JsonlFile {
    private messages: Message[] = [];
    private watcher: ReturnType<typeof watch> | null = null;
    private byteOffset: number = 0;
    private _sessionId: string | null = null;
    private _isSidechain: boolean | null = null;
    private emitNewMessages: boolean = false;

    protected processObject(obj: unknown): void {
        const result = MessageSchema.safeParse(obj);
        if (result.success) {
            this.messages.push(result.data);

            if (this._sessionId === null && result.data.type !== 'file-history-snapshot') {
                this._sessionId = result.data.sessionId;
                this._isSidechain = result.data.isSidechain;
            }

            if (this.emitNewMessages) {
                this.emit('message', result.data);
            }
        }
    }

    async load(): Promise<void> {
        this.messages = [];
        this._sessionId = null;
        this._isSidechain = null;
        await super.load();
        this.byteOffset = await this.getFileSize();
    }

    private async getFileSize(): Promise<number> {
        const stats = await stat(this.source);
        return stats.size;
    }

    get sessionId(): string | null {
        return this._sessionId;
    }

    get isSidechain(): boolean | null {
        return this._isSidechain;
    }

    getMessages(): readonly Message[] {
        return [...this.messages];
    }

    getMessage(uuid: string): Message | undefined {
        return this.messages.find((msg) => {
            if (msg.type === 'file-history-snapshot') {
                return msg.messageId === uuid;
            }
            return msg.uuid === uuid;
        });
    }

    subscribe(): void {
        if (this.watcher) return;

        this.watcher = watch(this.source, async (eventType) => {
            if (eventType === 'change') {
                try {
                    await this.loadNewMessages();
                } catch (error) {
                    this.emit('error', error instanceof Error ? error : new Error(String(error)));
                }
            }
        });

        this.watcher.on('error', (error) => {
            this.emit(
                'error',
                new Error(`File watch failed for: ${this.source}`, { cause: error })
            );
            this.unsubscribe();
        });
    }

    unsubscribe(): void {
        if (this.watcher) {
            try {
                this.watcher.close();
            } catch (error) {
                this.emit(
                    'error',
                    new Error(`Failed to close watcher: ${this.source}`, { cause: error })
                );
            } finally {
                this.watcher = null;
            }
        }
    }

    private async loadNewMessages(): Promise<void> {
        const currentSize = await this.getFileSize();
        if (currentSize <= this.byteOffset) return;

        this.emitNewMessages = true;
        await super.load({ start: this.byteOffset });
        this.emitNewMessages = false;

        this.byteOffset = currentSize;
    }

    static async create(source: string): Promise<Conversation> {
        const conversation = new Conversation(source);
        await conversation.load();
        return conversation;
    }

    export(format: ExportFormat): string {
        switch (format) {
            case 'json':
                return JSON.stringify(this.messages, null, 2);

            case 'markdown':
                return this.messages
                    .filter((msg): msg is UserMessage | AssistantMessage =>
                        msg.type === 'user' || msg.type === 'assistant'
                    )
                    .map((msg) => {
                        const role = msg.type === 'user' ? '**User**' : '**Assistant**';
                        const content = typeof msg.message.content === 'string'
                            ? msg.message.content
                            : msg.message.content
                                .filter((block) => block.type === 'text')
                                .map((block) => 'text' in block ? block.text : '')
                                .join('\n');
                        return `${role}\n\n${content}`;
                    })
                    .join('\n\n---\n\n');

            case 'text':
                return this.messages
                    .filter((msg): msg is UserMessage | AssistantMessage =>
                        msg.type === 'user' || msg.type === 'assistant'
                    )
                    .map((msg) => {
                        const role = msg.type === 'user' ? 'User:' : 'Assistant:';
                        const content = typeof msg.message.content === 'string'
                            ? msg.message.content
                            : msg.message.content
                                .filter((block) => block.type === 'text')
                                .map((block) => 'text' in block ? block.text : '')
                                .join('\n');
                        return `${role}\n${content}`;
                    })
                    .join('\n\n');

            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }

    search(pattern: string | RegExp): Message[] {
        const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;

        return this.messages.filter((msg) => {
            if (msg.type === 'file-history-snapshot') {
                return false;
            }

            const content = msg.message.content;
            if (typeof content === 'string') {
                return regex.test(content);
            }

            return content.some((block) => {
                if (block.type === 'text') {
                    return regex.test(block.text);
                }
                return false;
            });
        });
    }

    filter(criteria: FilterCriteria): Message[] {
        return this.messages.filter((msg) => {
            if (criteria.type && msg.type !== criteria.type) {
                return false;
            }

            if (msg.type === 'file-history-snapshot') {
                const timestamp = new Date(msg.snapshot.timestamp);
                if (criteria.startDate && timestamp < criteria.startDate) {
                    return false;
                }
                if (criteria.endDate && timestamp > criteria.endDate) {
                    return false;
                }
            } else {
                const timestamp = new Date(msg.timestamp);
                if (criteria.startDate && timestamp < criteria.startDate) {
                    return false;
                }
                if (criteria.endDate && timestamp > criteria.endDate) {
                    return false;
                }
            }

            return true;
        });
    }

    async clear(): Promise<void> {
        this.messages = [];
        this._sessionId = null;
        this._isSidechain = null;
        this.byteOffset = 0;
        await writeFile(this.source, '');
    }

    async deleteMessage(uuid: string): Promise<boolean> {
        const index = this.messages.findIndex((msg) => {
            if (msg.type === 'file-history-snapshot') {
                return msg.messageId === uuid;
            }
            return msg.uuid === uuid;
        });

        if (index === -1) {
            return false;
        }

        this.messages.splice(index, 1);
        const content = this.messages.map((msg) => JSON.stringify(msg)).join('\n');
        await writeFile(this.source, content ? content + '\n' : '');
        this.byteOffset = Buffer.byteLength(content ? content + '\n' : '');

        return true;
    }
}
