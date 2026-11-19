import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';

/**
 * Birden fazla API süreci çalıştığında bir süreçten gönderilen olay, başka süreçteki
 * socket'e Redis pub/sub üzerinden ulaşır. Not: yük dengeleyicide ya sticky session ya da
 * istemcide yalnızca "websocket" taşıması kullanılmalı (mobil istemci websocket kullanır).
 */
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>;
  private pub?: Redis;
  private sub?: Redis;

  constructor(
    app: INestApplicationContext,
    private readonly redisUrl: string,
    private readonly corsOrigins: string[],
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    this.pub = new Redis(this.redisUrl, { lazyConnect: true });
    this.sub = this.pub.duplicate();
    await Promise.all([this.pub.connect(), this.sub.connect()]);
    this.adapterConstructor = createAdapter(this.pub, this.sub);
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    const withCors = {
      ...options,
      ...(this.corsOrigins.length > 0 ? { cors: { origin: this.corsOrigins } } : {}),
    } as ServerOptions;
    const server = super.createIOServer(port, withCors) as Server;
    if (this.adapterConstructor) server.adapter(this.adapterConstructor);
    return server;
  }

  override async close(server: Server): Promise<void> {
    await super.close(server);
    for (const client of [this.pub, this.sub]) {
      await client?.quit().catch(() => client.disconnect());
    }
  }
}
