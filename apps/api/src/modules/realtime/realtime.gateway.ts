import { Logger } from '@nestjs/common';
import { type OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

import { AppException } from '../../common/errors/app.exception.js';
import { AccessAuthenticator } from '../auth/access-authenticator.js';
import { sessionRoom, userRoom } from './realtime.events.js';

type SocketData = { userId: string; sessionId: string };

/**
 * Socket.IO uç noktası: /ws. Kimlik doğrulama bağlantı katmanında (middleware) yapılır; doğrulanmamış
 * istemci hiçbir odaya katılmaz, hiçbir olay almaz. İstemciden gelen olay dinlenmez.
 */
@WebSocketGateway({ path: '/ws', transports: ['websocket'], serveClient: false })
export class RealtimeGateway implements OnGatewayInit {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly authenticator: AccessAuthenticator) {}

  afterInit(server: Server): void {
    server.use((socket: Socket, next) => {
      const token: unknown = (socket.handshake.auth as { token?: unknown } | undefined)?.token;
      if (typeof token !== 'string' || token.length === 0) {
        next(Object.assign(new Error('UNAUTHENTICATED'), { data: { code: 'UNAUTHENTICATED' } }));
        return;
      }
      this.authenticator
        .authenticate(token)
        .then(async (access) => {
          if (access.deletionPending) throw new Error('ACCOUNT_DELETION_PENDING');
          (socket.data as SocketData) = { userId: access.userId, sessionId: access.sessionId };
          await socket.join([userRoom(access.userId), sessionRoom(access.sessionId)]);
          next();
        })
        .catch((error: unknown) => {
          const code = error instanceof AppException ? error.code : 'UNAUTHENTICATED';
          next(Object.assign(new Error(code), { data: { code } }));
        });
    });
    this.logger.log('WebSocket /ws hazır');
  }
}
