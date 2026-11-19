import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Queue } from 'bullmq';
import request from 'supertest';
import { io, type Socket } from 'socket.io-client';

import { PrismaService } from '../src/infra/prisma/prisma.service.js';
import { NOTIFICATIONS_QUEUE_TOKEN } from '../src/infra/queue/queue.module.js';
import { PushDeliveryService } from '../src/modules/notifications/push/push-delivery.service.js';
import { PUSH_SENDER } from '../src/modules/notifications/push/push-sender.js';
import { resetDatabase } from './support/auth-helpers.js';
import { createTestApp } from './support/create-test-app.js';
import { makeUser, PLACES, type TestUser } from './support/discovery-helpers.js';
import type { PushRecorder } from './support/push-recorder.js';

describe('Sohbet, gerçek zamanlı olaylar ve bildirimler', () => {
  let app: NestExpressApplication;
  let server: ReturnType<NestExpressApplication['getHttpServer']>;
  let prisma: PrismaService;
  let baseUrl: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    await app.listen(0, '127.0.0.1');
    server = app.getHttpServer();
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(app);
    await app.get<Queue>(NOTIFICATIONS_QUEUE_TOKEN).obliterate({ force: true });
  });

  afterEach(() => {
    for (const s of sockets.splice(0)) s.disconnect();
  });

  afterAll(async () => {
    await app.close();
  });

  async function matchedPair(): Promise<{
    a: TestUser;
    b: TestUser;
    conversationId: string;
    matchId: string;
  }> {
    const a = await makeUser(app, { name: 'Ece', gender: 'WOMAN', seeking: ['MAN'] });
    const b = await makeUser(app, {
      name: 'Kaan',
      gender: 'MAN',
      seeking: ['WOMAN'],
      place: PLACES.besiktas,
    });
    await request(server)
      .post('/api/v1/likes')
      .set(a.auth)
      .send({ targetUserId: b.userId })
      .expect(200);
    const res = await request(server)
      .post('/api/v1/likes')
      .set(b.auth)
      .send({ targetUserId: a.userId })
      .expect(200);
    return { a, b, conversationId: res.body.data.conversationId, matchId: res.body.data.matchId };
  }

  const send = (u: TestUser, conversationId: string, body: string, id: string = randomUUID()) =>
    request(server)
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set(u.auth)
      .send({ id, body });

  function connect(token?: string): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const socket = io(baseUrl, {
        path: '/ws',
        transports: ['websocket'],
        auth: token ? { token } : {},
        reconnection: false,
      });
      sockets.push(socket);
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', (error) => reject(error));
    });
  }

  function nextEvent<T>(socket: Socket, event: string, timeoutMs = 3000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${event} gelmedi`)), timeoutMs);
      socket.once(event, (payload: T) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });
  }

  const pushJobs = async () =>
    (await app.get<Queue>(NOTIFICATIONS_QUEUE_TOKEN).getJobs(['waiting', 'delayed', 'active'])).map(
      (j) =>
        j.data as {
          userId: string;
          kind: string;
        },
    );

  describe('sohbet', () => {
    it('eşleşme sohbet açar; iki taraf da görür', async () => {
      const { a, b, conversationId } = await matchedPair();
      for (const u of [a, b]) {
        const list = await request(server).get('/api/v1/conversations').set(u.auth).expect(200);
        expect(list.body.data).toHaveLength(1);
        expect(list.body.data[0]).toMatchObject({
          id: conversationId,
          lastMessage: null,
          unreadCount: 0,
        });
      }
      const forA = await request(server).get('/api/v1/conversations').set(a.auth).expect(200);
      expect(forA.body.data[0].otherUser).toMatchObject({ userId: b.userId, displayName: 'Kaan' });
    });

    it('mesaj gönderme, okunmamış sayısı ve okundu bilgisi', async () => {
      const { a, b, conversationId } = await matchedPair();
      const first = await send(a, conversationId, '  Merhaba!  ').expect(201);
      expect(first.body.data).toMatchObject({
        senderId: a.userId,
        body: 'Merhaba!',
        type: 'TEXT',
        deletedAt: null,
      });
      await send(a, conversationId, 'Nasılsın?').expect(201);

      const forB = await request(server).get('/api/v1/conversations').set(b.auth).expect(200);
      expect(forB.body.data[0]).toMatchObject({
        unreadCount: 2,
        lastMessage: { body: 'Nasılsın?' },
      });
      const forA = await request(server).get('/api/v1/conversations').set(a.auth).expect(200);
      expect(forA.body.data[0].unreadCount).toBe(0);

      const messages = await request(server)
        .get(`/api/v1/conversations/${conversationId}/messages`)
        .set(b.auth)
        .expect(200);
      expect(messages.body.data.map((m: { body: string }) => m.body)).toEqual([
        'Nasılsın?',
        'Merhaba!',
      ]);

      await request(server)
        .post(`/api/v1/conversations/${conversationId}/read`)
        .set(b.auth)
        .send({ lastReadMessageId: messages.body.data[0].id })
        .expect(204);
      expect(
        (await request(server).get('/api/v1/conversations').set(b.auth)).body.data[0].unreadCount,
      ).toBe(0);
      const seen = await request(server)
        .get(`/api/v1/conversations/${conversationId}`)
        .set(a.auth)
        .expect(200);
      expect(seen.body.data.otherLastReadAt).toBe(messages.body.data[0].createdAt);

      // Daha eski bir mesajla okundu bilgisi geri alınamaz
      await request(server)
        .post(`/api/v1/conversations/${conversationId}/read`)
        .set(b.auth)
        .send({ lastReadMessageId: messages.body.data[1].id })
        .expect(204);
      const still = await request(server)
        .get(`/api/v1/conversations/${conversationId}`)
        .set(a.auth)
        .expect(200);
      expect(still.body.data.otherLastReadAt).toBe(messages.body.data[0].createdAt);
    });

    it('istemci kimliğiyle idempotent; kimlik başkasınca kullanılmışsa 409', async () => {
      const { a, b, conversationId } = await matchedPair();
      const id = randomUUID();
      const one = await send(a, conversationId, 'Selam', id).expect(201);
      const two = await send(a, conversationId, 'Selam', id).expect(201);
      expect(two.body.data).toEqual(one.body.data);
      expect(await prisma.message.count()).toBe(1);
      const conflict = await send(b, conversationId, 'Selam', id).expect(409);
      expect(conflict.body.error.code).toBe('MESSAGE_ID_CONFLICT');
    });

    it('boş ve çok uzun mesaj reddedilir', async () => {
      const { a, conversationId } = await matchedPair();
      expect((await send(a, conversationId, '   ').expect(400)).body.error.code).toBe(
        'EMPTY_MESSAGE',
      );
      expect((await send(a, conversationId, 'x'.repeat(2001)).expect(400)).body.error.code).toBe(
        'VALIDATION_FAILED',
      );
    });

    it('katılımcı olmayan kişi sohbete erişemez (404)', async () => {
      const { a, conversationId } = await matchedPair();
      await send(a, conversationId, 'gizli').expect(201);
      const outsider = await makeUser(app, { gender: 'WOMAN', seeking: ['MAN'] });
      await request(server)
        .get(`/api/v1/conversations/${conversationId}`)
        .set(outsider.auth)
        .expect(404);
      await request(server)
        .get(`/api/v1/conversations/${conversationId}/messages`)
        .set(outsider.auth)
        .expect(404);
      await send(outsider, conversationId, 'merhaba').expect(404);
      expect(
        (await request(server).get('/api/v1/conversations').set(outsider.auth)).body.data,
      ).toEqual([]);
    });

    it('mesajlar sayfalanır (en yeni önce)', async () => {
      const { a, conversationId } = await matchedPair();
      // Gönderim sınırına takılmamak için doğrudan yazılır (sınır ayrı testte).
      const start = Date.now() - 60_000;
      await prisma.message.createMany({
        data: Array.from({ length: 35 }, (_, i) => ({
          id: randomUUID(),
          conversationId,
          senderId: a.userId,
          body: `mesaj ${i}`,
          createdAt: new Date(start + i * 1000),
        })),
      });
      const first = await request(server)
        .get(`/api/v1/conversations/${conversationId}/messages`)
        .set(a.auth)
        .expect(200);
      expect(first.body.data).toHaveLength(30);
      expect(first.body.data[0].body).toBe('mesaj 34');
      const second = await request(server)
        .get(
          `/api/v1/conversations/${conversationId}/messages?cursor=${first.body.meta.nextCursor}`,
        )
        .set(a.auth)
        .expect(200);
      expect(second.body.data.map((m: { body: string }) => m.body)).toEqual([
        'mesaj 4',
        'mesaj 3',
        'mesaj 2',
        'mesaj 1',
        'mesaj 0',
      ]);
      expect(second.body.meta.nextCursor).toBeNull();
    });

    it('dakikada 30’dan fazla mesaj → 429', async () => {
      const { a, conversationId } = await matchedPair();
      for (let i = 0; i < 30; i++) await send(a, conversationId, `m${i}`).expect(201);
      expect((await send(a, conversationId, 'fazla').expect(429)).body.error.code).toBe(
        'RATE_LIMITED',
      );
    });

    it('yalnızca kendi mesajını silebilir; silinen mesajın metni kalmaz', async () => {
      const { a, b, conversationId } = await matchedPair();
      const msg = (await send(a, conversationId, 'yanlışlıkla').expect(201)).body.data;
      await request(server)
        .delete(`/api/v1/conversations/${conversationId}/messages/${msg.id}`)
        .set(b.auth)
        .expect(404);
      await request(server)
        .delete(`/api/v1/conversations/${conversationId}/messages/${msg.id}`)
        .set(a.auth)
        .expect(204);
      const list = await request(server)
        .get(`/api/v1/conversations/${conversationId}/messages`)
        .set(b.auth)
        .expect(200);
      expect(list.body.data[0]).toMatchObject({ id: msg.id, body: '' });
      expect(list.body.data[0].deletedAt).toBeTruthy();
      expect((await prisma.message.findUniqueOrThrow({ where: { id: msg.id } })).body).toBe('');
    });

    it.each(['unmatch', 'block'] as const)(
      '%s sonrası sohbet kapanır; mesajlar kanıt olarak saklanır',
      async (how) => {
        const { a, b, conversationId, matchId } = await matchedPair();
        await send(a, conversationId, 'merhaba').expect(201);
        if (how === 'unmatch')
          await request(server).delete(`/api/v1/matches/${matchId}`).set(b.auth).expect(204);
        else
          await request(server)
            .post('/api/v1/safety/blocks')
            .set(b.auth)
            .send({ userId: a.userId })
            .expect(204);

        for (const u of [a, b]) {
          await request(server)
            .get(`/api/v1/conversations/${conversationId}/messages`)
            .set(u.auth)
            .expect(404);
          await send(u, conversationId, 'hâlâ orada mısın?').expect(404);
          expect(
            (await request(server).get('/api/v1/conversations').set(u.auth)).body.data,
          ).toEqual([]);
        }
        expect(await prisma.message.count({ where: { conversationId } })).toBe(1);
      },
    );
  });

  describe('gerçek zamanlı (Socket.IO /ws)', () => {
    it('token olmadan veya geçersiz token ile bağlantı reddedilir', async () => {
      await expect(connect()).rejects.toThrow(/UNAUTHENTICATED/);
      await expect(connect('bozuk.token.degeri')).rejects.toThrow(/TOKEN_INVALID/);
    });

    it('yeni mesaj karşı tarafa canlı ulaşır; dışarıdaki kullanıcıya ulaşmaz', async () => {
      const { a, b, conversationId } = await matchedPair();
      const outsider = await makeUser(app, { gender: 'WOMAN', seeking: ['MAN'] });
      const bSocket = await connect(b.accessToken);
      const outsiderSocket = await connect(outsider.accessToken);
      let leaked = false;
      outsiderSocket.on('message:new', () => {
        leaked = true;
      });

      const incoming = nextEvent<{ body: string; conversationId: string }>(bSocket, 'message:new');
      await send(a, conversationId, 'canlı mesaj').expect(201);
      expect(await incoming).toMatchObject({ body: 'canlı mesaj', conversationId });
      await new Promise((r) => setTimeout(r, 200));
      expect(leaked).toBe(false);
    });

    it('eşleşme bitince iki tarafa conversation:closed gider', async () => {
      const { a, b, conversationId, matchId } = await matchedPair();
      const aSocket = await connect(a.accessToken);
      const closed = nextEvent<{ conversationId: string }>(aSocket, 'conversation:closed');
      await request(server).delete(`/api/v1/matches/${matchId}`).set(b.auth).expect(204);
      expect(await closed).toEqual({ conversationId });
    });

    it('çıkış yapılınca o oturumun socket bağlantısı kesilir', async () => {
      const { a } = await matchedPair();
      const socket = await connect(a.accessToken);
      const disconnected = new Promise<void>((resolve) =>
        socket.once('disconnect', () => resolve()),
      );
      await request(server).post('/api/v1/auth/logout').set(a.auth).expect(204);
      await disconnected;
    });
  });

  describe('bildirimler', () => {
    it('alıcı çevrimdışıysa push işi kuyruğa alınır, çevrimiçiyse alınmaz', async () => {
      const { a, b, conversationId } = await matchedPair();
      // Eşleşmede yalnızca karşı taraf (ilk beğenen a) bildirim alır.
      expect(await pushJobs()).toEqual([
        expect.objectContaining({ userId: a.userId, kind: 'NEW_MATCH' }),
      ]);
      await app.get<Queue>(NOTIFICATIONS_QUEUE_TOKEN).obliterate({ force: true });

      await send(a, conversationId, 'çevrimdışıyken').expect(201);
      expect(await pushJobs()).toEqual([
        expect.objectContaining({ userId: b.userId, kind: 'NEW_MESSAGE' }),
      ]);
      await app.get<Queue>(NOTIFICATIONS_QUEUE_TOKEN).obliterate({ force: true });

      await connect(b.accessToken);
      await send(a, conversationId, 'çevrimiçiyken').expect(201);
      expect(await pushJobs()).toEqual([]);
    });

    it('gönderim: mesaj metni ve ad içermez; tercih kapalıysa gönderilmez; geçersiz token devre dışı kalır', async () => {
      const { a, conversationId } = await matchedPair();
      const recorder = app.get<PushRecorder>(PUSH_SENDER);
      recorder.sent.length = 0;
      await request(server)
        .post('/api/v1/devices')
        .set(a.auth)
        .send({ platform: 'IOS', pushToken: 'ios-token-1' })
        .expect(200);
      await request(server)
        .post('/api/v1/devices')
        .set(a.auth)
        .send({ platform: 'ANDROID', pushToken: 'android-token-1' })
        .expect(200);
      recorder.invalidTokens.add('android-token-1');

      const delivery = app.get(PushDeliveryService);
      expect(
        await delivery.deliver({ userId: a.userId, kind: 'NEW_MESSAGE', conversationId }),
      ).toEqual({ sent: 1, disabled: 1 });
      expect(recorder.sent[0]!.message).toEqual({
        title: 'Yeni mesaj',
        body: 'Bir eşleşmen sana yazdı.',
        data: { type: 'NEW_MESSAGE', conversationId },
      });
      expect(
        (await prisma.userDevice.findUniqueOrThrow({ where: { pushToken: 'android-token-1' } }))
          .disabledAt,
      ).toBeTruthy();

      await request(server)
        .put('/api/v1/notifications/settings')
        .set(a.auth)
        .send({ newMatch: true, newMessage: false })
        .expect(200);
      expect(
        await delivery.deliver({ userId: a.userId, kind: 'NEW_MESSAGE', conversationId }),
      ).toEqual({
        sent: 0,
        disabled: 0,
        skipped: 'settings',
      });
    });

    it('cihaz token’ı başka hesaba geçer; çıkışta cihaz kaydı silinir', async () => {
      const { a, b } = await matchedPair();
      await request(server)
        .post('/api/v1/devices')
        .set(a.auth)
        .send({ platform: 'IOS', pushToken: 'shared-phone' })
        .expect(200);
      await request(server)
        .post('/api/v1/devices')
        .set(b.auth)
        .send({ platform: 'IOS', pushToken: 'shared-phone' })
        .expect(200);
      expect(
        (await prisma.userDevice.findUniqueOrThrow({ where: { pushToken: 'shared-phone' } }))
          .userId,
      ).toBe(b.userId);

      await request(server).post('/api/v1/auth/logout').set(b.auth).expect(204);
      expect(await prisma.userDevice.count({ where: { pushToken: 'shared-phone' } })).toBe(0);
    });

    it('geçersiz token biçimi reddedilir', async () => {
      const { a } = await matchedPair();
      await request(server)
        .post('/api/v1/devices')
        .set(a.auth)
        .send({ platform: 'IOS', pushToken: 'boşluk var' })
        .expect(400);
    });
  });
});
