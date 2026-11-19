import { QueryClient } from '@tanstack/react-query';

// gcTime: Infinity → test bitince açık zamanlayıcı kalmaz (Jest kapanabilsin).
const newClient = () => new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });

import {
  type ChatMessage,
  flattenMessages,
  markDeleted,
  messagesKey,
  upsertMessage,
} from '../cache';

const message = (id: string, body = id): ChatMessage => ({
  id,
  conversationId: 'c1',
  senderId: 'u1',
  type: 'TEXT',
  body,
  createdAt: new Date().toISOString(),
  flagged: false,
  deletedAt: null,
});

function seeded() {
  const client = newClient();
  client.setQueryData(messagesKey('c1'), {
    pages: [{ data: [message('m2'), message('m1')], meta: { nextCursor: null } }],
    pageParams: [undefined],
  });
  return client;
}

const ids = (client: QueryClient) =>
  flattenMessages(client.getQueryData(messagesKey('c1'))).map((m) => m.id);

describe('sohbet önbelleği', () => {
  it('yeni mesajı en başa ekler', () => {
    const client = seeded();
    upsertMessage(client, message('m3'));
    expect(ids(client)).toEqual(['m3', 'm2', 'm1']);
  });

  it('aynı kimlik ikinci kez gelirse (socket + REST) çoğaltmaz, günceller', () => {
    const client = seeded();
    upsertMessage(client, { ...message('m3'), localStatus: 'sending' });
    upsertMessage(client, message('m3', 'kesin hali'));
    upsertMessage(client, message('m3', 'kesin hali'));
    const list = flattenMessages(client.getQueryData(messagesKey('c1')));
    expect(list.map((m) => m.id)).toEqual(['m3', 'm2', 'm1']);
    expect(list[0]?.body).toBe('kesin hali');
    expect(list[0]?.localStatus).toBeUndefined();
  });

  it('silinen mesajın metnini temizler', () => {
    const client = seeded();
    markDeleted(client, 'c1', 'm1');
    const deleted = flattenMessages(client.getQueryData(messagesKey('c1'))).find(
      (m) => m.id === 'm1',
    );
    expect(deleted).toMatchObject({ body: '' });
    expect(deleted?.deletedAt).toBeTruthy();
  });

  it('sohbet önbellekte yoksa dokunmaz', () => {
    const client = newClient();
    upsertMessage(client, message('x'));
    expect(client.getQueryData(messagesKey('c1'))).toBeUndefined();
  });
});
