import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module.js';
import { configureApp } from './bootstrap.js';
import { loadEnvFile } from './config/load-env-file.js';

loadEnvFile();

const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
const config = configureApp(app);
await app.listen(config.PORT, config.HOST);
