import { SSEEmitter } from '../utils/sseEmitter';

describe('SSEEmitter', () => {
    it('sets SSE headers and writes framed events', () => {
        const headers: Record<string, string> = {};
        const writes: string[] = [];
        const res = {
            setHeader: jest.fn((key: string, value: string) => {
                headers[key] = value;
            }),
            flushHeaders: jest.fn(),
            write: jest.fn((chunk: string) => {
                writes.push(chunk);
            }),
            end: jest.fn(),
        } as any;

        const emitter = new SSEEmitter(res);
        emitter.emit('stage', { stage: 'discovering' });
        emitter.done();

        expect(headers['Content-Type']).toBe('text/event-stream');
        expect(headers['Cache-Control']).toBe('no-cache');
        expect(writes[0]).toContain('event: stage');
        expect(writes[0]).toContain('"discovering"');
        expect(writes[1]).toContain('event: done');
        expect(res.end).toHaveBeenCalled();
    });
});
