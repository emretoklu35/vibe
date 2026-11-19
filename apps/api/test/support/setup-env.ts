import 'reflect-metadata';

import { resolveTestEnv } from './test-env.js';

const { databaseUrl, redisUrl } = resolveTestEnv();

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = databaseUrl;
process.env.REDIS_URL = redisUrl;
process.env.LOG_LEVEL = 'silent';
process.env.SWAGGER_ENABLED = 'true';
process.env.RATE_LIMIT_DEFAULT_PER_MINUTE = '1000';
// Testler ayrı bir bucket kullanır (geliştirme medyasına dokunulmaz).
process.env.S3_BUCKET = process.env.TEST_S3_BUCKET ?? 'vibe-test-media';
process.env.S3_AUTO_CREATE_BUCKET = 'true';
