import { Response } from 'express';

export class SSEEmitter {
    constructor(private res: Response) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders?.();
    }

    emit(event: string, data: unknown): void {
        this.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }

    done(): void {
        this.res.write('event: done\ndata: {}\n\n');
        this.res.end();
    }
}
