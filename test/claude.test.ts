/// <reference types="vitest" />
import { describe, it, expect } from 'vitest';
import { Claude } from '../src';

describe('Claude', () => {
    it('should start with session id', async () => {
        const claude = await Claude.spawn();
        expect(claude.sessionId).toBeDefined();
    }, 30_000);

    it('should start at cwd', async () => {
        const claude = await Claude.spawn();
        expect(claude.cwd).toBe(process.cwd());
    }, 30_000);

    it('should start at defined directory', async () => {
        const cwd = '/tmp';
        const claude = await Claude.spawn({ cwd });
        expect(claude.cwd).toBe(cwd);
    }, 30_000);

    it('should respond', async () => {
        const claude = await Claude.spawn();
        const response = await claude.query('Say "hello" and nothing else.');
        expect(response.text.toLowerCase()).toContain('hello');
    }, 30_000);
});
