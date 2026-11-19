import { PrismaPg } from '@prisma/adapter-pg';

import { INTERESTS, seedInterests } from '../prisma/seed.js';
import { PrismaClient } from '../src/generated/prisma/client.js';

describe('ilk migration + ilgi alanı kataloğu', () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('PostGIS eklentisi kurulu', async () => {
    const rows = await prisma.$queryRaw<{ extname: string }[]>`
      SELECT extname FROM pg_extension WHERE extname = 'postgis'`;
    expect(rows).toHaveLength(1);
  });

  it('tohum betiği tekrar çalıştırılabilir (idempotent) ve slug benzersiz', async () => {
    await seedInterests(prisma);
    await seedInterests(prisma);
    const slugs = INTERESTS.map((i) => i.slug);
    const count = await prisma.interest.count({ where: { slug: { in: slugs } } });
    expect(count).toBe(INTERESTS.length);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
