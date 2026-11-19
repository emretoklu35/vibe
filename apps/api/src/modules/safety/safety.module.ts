import { Module } from '@nestjs/common';

import { ChatModule } from '../chat/chat.module.js';
import { BlocksController } from './blocks.controller.js';
import { BlocksService } from './blocks.service.js';

@Module({ imports: [ChatModule], controllers: [BlocksController], providers: [BlocksService] })
export class SafetyModule {}
