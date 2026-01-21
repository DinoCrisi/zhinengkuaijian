import { describe, expect, it, vi, beforeEach } from 'vitest';
import { callProxy } from './proxyClient';

describe('callProxy', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends JSON body and returns parsed JSON', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true })
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await callProxy<{ ok: boolean }>('http://127.0.0.1:8888/api/chat', {
      target: 'doubao_chat',
      body: { hello: 'world' }
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as any;
    expect(init?.method).toBe('POST');
  });

  it('throws on non-OK response', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => 'boom'
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      callProxy('http://127.0.0.1:8888/api/chat', { target: 'doubao_chat', body: {} })
    ).rejects.toThrow(/Proxy Request Failed/);
  });
});

