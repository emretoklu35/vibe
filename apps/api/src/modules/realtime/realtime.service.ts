import { Injectable } from '@nestjs/common';

import { RealtimeGateway } from './realtime.gateway.js';
import { sessionRoom, userRoom } from './realtime.events.js';

/** Diğer modüllerin olay yaymak için kullandığı ince katman. Gateway hazır değilse sessizce geçer. */
@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: RealtimeGateway) {}

  emitToUsers(userIds: string[], event: string, payload: unknown): void {
    const server = this.gateway.server;
    if (!server || userIds.length === 0) return;
    server.to(userIds.map(userRoom)).emit(event, payload);
  }

  /** Kullanıcının herhangi bir API sürecinde açık socket'i var mı (Redis adapter üzerinden)? */
  async isOnline(userId: string): Promise<boolean> {
    const server = this.gateway.server;
    if (!server) return false;
    try {
      return (await server.in(userRoom(userId)).fetchSockets()).length > 0;
    } catch {
      return false;
    }
  }

  /** Oturum kapanınca o oturumun açık socket'leri hemen kesilir. */
  disconnectSession(sessionId: string): void {
    this.gateway.server?.in(sessionRoom(sessionId)).disconnectSockets(true);
  }

  disconnectUser(userId: string): void {
    this.gateway.server?.in(userRoom(userId)).disconnectSockets(true);
  }
}
