import { afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import { createServer, request as httpRequest } from 'node:http';
import { devTestUsersGuard } from '../devTestUsersGuard';
import devTestUsersRoutes from '../devTestUsersRoutes';

const savedReplId = process.env.REPL_ID;
const savedOptIn = process.env.DEV_TEST_IDENTITY_SWITCHER_ENABLED;

afterEach(() => {
  if (savedReplId === undefined) delete process.env.REPL_ID;
  else process.env.REPL_ID = savedReplId;
  if (savedOptIn === undefined) delete process.env.DEV_TEST_IDENTITY_SWITCHER_ENABLED;
  else process.env.DEV_TEST_IDENTITY_SWITCHER_ENABLED = savedOptIn;
});

function invokeGuard() {
  let nexted = false;
  let statusCode = 200;
  let body: unknown;
  const res = {
    status(code: number) { statusCode = code; return this; },
    json(value: unknown) { body = value; return this; },
  } as any;
  devTestUsersGuard({} as any, res, () => { nexted = true; });
  return { nexted, statusCode, body };
}

async function requestEndpoint(path: string, method: string) {
  const app = express();
  app.use(devTestUsersRoutes);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const statusCode = await new Promise<number>((resolve, reject) => {
    const request = httpRequest(
      { hostname: '127.0.0.1', port, path, method },
      (response: { statusCode?: number; on: (event: string, cb: () => void) => void }) => {
        response.on('data', () => undefined);
        response.on('end', () => resolve(response.statusCode ?? 0));
      },
    );
    request.on('error', reject);
    request.end();
  });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return statusCode;
}

async function requestProductionOrder(path: string) {
  const app = express();
  app.use('/technical/api/dev/test-users', devTestUsersGuard);
  app.use('/technical/api', (_req, res) => res.status(401).json({ error: 'tenant challenge' }));
  app.use('/technical/api', devTestUsersRoutes);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const statusCode = await new Promise<number>((resolve, reject) => {
    const request = httpRequest(
      { hostname: '127.0.0.1', port, path, method: 'GET' },
      (response: { statusCode?: number; on: (event: string, cb: () => void) => void }) => {
        response.on('data', () => undefined);
        response.on('end', () => resolve(response.statusCode ?? 0));
      },
    );
    request.on('error', reject);
    request.end();
  });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return statusCode;
}

describe('dev test user identity switcher guard', () => {
  it.each([
    ['neither key', undefined, undefined],
    ['REPL_ID only', 'repl-test', undefined],
    ['opt-in only', undefined, 'true'],
  ])('returns 404 with %s', (_label, replId, optIn) => {
    if (replId === undefined) delete process.env.REPL_ID;
    else process.env.REPL_ID = replId;
    if (optIn === undefined) delete process.env.DEV_TEST_IDENTITY_SWITCHER_ENABLED;
    else process.env.DEV_TEST_IDENTITY_SWITCHER_ENABLED = optIn;
    expect(invokeGuard()).toEqual({
      nexted: false,
      statusCode: 404,
      body: { error: 'Not found' },
    });
  });

  it('passes only when both intrinsic and explicit keys are present', () => {
    process.env.REPL_ID = 'repl-test';
    process.env.DEV_TEST_IDENTITY_SWITCHER_ENABLED = 'true';
    expect(invokeGuard()).toEqual({ nexted: true, statusCode: 200, body: undefined });
  });

  it.each([
    ['neither key', undefined, undefined],
    ['REPL_ID only', 'repl-test', undefined],
    ['opt-in only', undefined, 'true'],
  ])('returns endpoint 404 with %s', async (_label, replId, optIn) => {
    if (replId === undefined) delete process.env.REPL_ID;
    else process.env.REPL_ID = replId;
    if (optIn === undefined) delete process.env.DEV_TEST_IDENTITY_SWITCHER_ENABLED;
    else process.env.DEV_TEST_IDENTITY_SWITCHER_ENABLED = optIn;
    await expect(requestEndpoint('/dev/test-users', 'GET')).resolves.toBe(404);
    await expect(requestEndpoint('/dev/test-users/u1/resolution', 'GET')).resolves.toBe(404);
    await expect(requestEndpoint('/dev/test-users/u1/vessels', 'POST')).resolves.toBe(404);
    await expect(requestEndpoint('/dev/test-users/u1/vessels/v1', 'DELETE')).resolves.toBe(404);
  });

  it.each([
    ['neither key', undefined, undefined],
    ['REPL_ID only', 'repl-test', undefined],
    ['opt-in only', undefined, 'true'],
  ])('returns 404 before tenant middleware with %s', async (_label, replId, optIn) => {
    if (replId === undefined) delete process.env.REPL_ID;
    else process.env.REPL_ID = replId;
    if (optIn === undefined) delete process.env.DEV_TEST_IDENTITY_SWITCHER_ENABLED;
    else process.env.DEV_TEST_IDENTITY_SWITCHER_ENABLED = optIn;
    await expect(
      requestProductionOrder('/technical/api/dev/test-users'),
    ).resolves.toBe(404);
  });
});