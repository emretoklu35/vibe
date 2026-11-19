import {
  CopyObjectCommand,
  CreateBucketCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  NotFound,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.js';

/**
 * Özel (private) nesne depolama. İstemciler dosyalara yalnızca kısa ömürlü presigned URL'lerle erişir.
 * İki istemci vardır: sunucunun kendi işlemleri için ve istemcilere verilecek URL'leri imzalamak için
 * (ör. Android emülatörü S3'e 10.0.2.2 üzerinden ulaşır).
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly presignClient: S3Client;
  readonly bucket: string;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    const base: S3ClientConfig = {
      region: config.S3_REGION,
      forcePathStyle: config.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: config.S3_ACCESS_KEY_ID,
        secretAccessKey: config.S3_SECRET_ACCESS_KEY,
      },
      // Yeni SDK'lar presigned URL'lere varsayılan olarak checksum ekler; istemci yüklemelerini
      // bozmamak için yalnızca gerektiğinde hesaplanır.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    };
    this.client = new S3Client({ ...base, endpoint: config.S3_ENDPOINT });
    this.presignClient = new S3Client({
      ...base,
      endpoint: config.S3_PUBLIC_ENDPOINT ?? config.S3_ENDPOINT,
    });
    this.bucket = config.S3_BUCKET;
  }

  async onModuleInit(): Promise<void> {
    if (!this.config.S3_AUTO_CREATE_BUCKET) return;
    try {
      await this.ensureBucket();
    } catch (error) {
      // Geliştirmede S3 kapalı olabilir; uygulama yine açılır, ilgili istekler hata verir.
      this.logger.warn(`Bucket hazırlanamadı: ${(error as Error).message}`);
    }
  }

  /** Yalnızca geliştirme: bucket'ı oluşturur ve tarayıcıdan yükleme için CORS ayarlar. */
  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Bucket oluşturuldu: ${this.bucket}`);
    }
    if (this.config.CORS_ORIGINS.length > 0) {
      await this.client.send(
        new PutBucketCorsCommand({
          Bucket: this.bucket,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedOrigins: this.config.CORS_ORIGINS,
                AllowedMethods: ['GET', 'PUT'],
                AllowedHeaders: ['*'],
                MaxAgeSeconds: 600,
              },
            ],
          },
        }),
      );
    }
  }

  presignUpload(key: string, contentType: string, contentLength: number, expiresIn: number) {
    return getSignedUrl(
      this.presignClient,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: contentLength,
      }),
      { expiresIn },
    );
  }

  presignDownload(key: string, expiresIn: number) {
    return getSignedUrl(
      this.presignClient,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      {
        expiresIn,
      },
    );
  }

  /** Nesne yoksa undefined. */
  async size(key: string): Promise<number | undefined> {
    try {
      const head = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return head.ContentLength;
    } catch (error) {
      if (error instanceof NotFound || (error as { name?: string }).name === 'NotFound')
        return undefined;
      throw error;
    }
  }

  async read(key: string): Promise<Buffer> {
    const object = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!object.Body) throw new Error(`Boş nesne: ${key}`);
    return Buffer.from(await object.Body.transformToByteArray());
  }

  async write(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  /** Sunucu tarafında kopyalama (ör. şikayet kanıtı: kullanıcı silse de kopya kalır). */
  async copy(sourceKey: string, targetKey: string): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${encodeURIComponent(sourceKey).replace(/%2F/g, '/')}`,
        Key: targetKey,
      }),
    );
  }

  async remove(keys: string[]): Promise<void> {
    for (let i = 0; i < keys.length; i += 1000) {
      const batch = keys.slice(i, i + 1000);
      if (batch.length === 0) continue;
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
        }),
      );
    }
  }

  /** Önekteki tüm nesneleri siler (ör. hesap silmede kullanıcının tüm medyası). */
  async removePrefix(prefix: string): Promise<number> {
    let removed = 0;
    let token: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }),
      );
      const keys = (page.Contents ?? []).map((o) => o.Key).filter((k): k is string => Boolean(k));
      await this.remove(keys);
      removed += keys.length;
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return removed;
  }
}
