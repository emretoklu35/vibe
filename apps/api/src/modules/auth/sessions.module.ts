import { Module } from '@nestjs/common';

import { SessionsService } from './sessions.service.js';
import { TokensService } from './tokens.service.js';

@Module({ providers: [TokensService, SessionsService], exports: [TokensService, SessionsService] })
export class SessionsModule {}
