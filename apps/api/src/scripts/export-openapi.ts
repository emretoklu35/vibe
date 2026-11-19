/**
 * OpenAPI belgesini packages/api-contract/openapi.json'a yazar.
 * Çalıştırma: npm run contract:generate (kökten) — önce API derlenir, sonra tipler üretilir.
 * Belge üretmek için veritabanına bağlanılmaz; yalnızca uygulama modülleri yüklenir.
 */
import 'reflect-metadata';

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from '../app.module.js';
import { API_PREFIX, buildOpenApiDocument } from '../bootstrap.js';
import { loadEnvFile } from '../config/load-env-file.js';
import { VersioningType } from '@nestjs/common';

loadEnvFile();
process.env.LOG_LEVEL = 'silent';

const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
app.setGlobalPrefix(API_PREFIX);
app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
await app.init();

const document = buildOpenApiDocument(app);
const target = resolve(import.meta.dirname, '../../../../../packages/api-contract/openapi.json');
writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
await app.close();
console.log(`OpenAPI yazıldı: ${target}`);
