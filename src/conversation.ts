import { watch } from 'node:fs';
import { stat } from 'node:fs/promises';
import { JsonlFile } from './common/jsonl';
import { Message, MessageSchema } from './common/schemas';

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
}
