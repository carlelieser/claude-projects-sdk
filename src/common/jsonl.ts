import { createReadStream, ReadStreamOptions } from 'node:fs';
import { createInterface } from 'node:readline';
import { EventEmitter } from 'node:events';

export abstract class JsonlFile extends EventEmitter {
    readonly source: string;

    constructor(source: string) {
        super();
        this.source = source;
    }

    protected abstract processObject(obj: unknown): boolean | void;

    async load(options?: ReadStreamOptions): Promise<void> {
        const rl = createInterface({
            input: createReadStream(this.source, options),
            crlfDelay: Infinity,
        });

        for await (const line of rl) {
            try {
                const obj = JSON.parse(line);
                if (this.processObject(obj) === true) break;
            } catch (error) {
                this.emit('parseError', {
                    line,
                    error: error instanceof Error ? error : new Error(String(error)),
                });
            }
        }

        rl.close();
    }
}
