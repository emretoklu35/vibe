/**
 * İlgi alanı kataloğu (referans veri). Tüm ortamlarda güvenle tekrar çalıştırılabilir (upsert).
 * Sahte kullanıcı verisi burada YOK; o yalnızca ileride ayrı bir local/staging betiğine girer.
 */
import { PrismaPg } from '@prisma/adapter-pg';

import { loadEnvFile } from '../src/config/load-env-file.js';
import { PrismaClient } from '../src/generated/prisma/client.js';

type InterestSeed = { slug: string; category: string; labelTr: string; labelEn: string };

export const INTERESTS: readonly InterestSeed[] = [
  { slug: 'coffee', category: 'food-drink', labelTr: 'Kahve', labelEn: 'Coffee' },
  { slug: 'cooking', category: 'food-drink', labelTr: 'Yemek yapmak', labelEn: 'Cooking' },
  { slug: 'wine', category: 'food-drink', labelTr: 'Şarap', labelEn: 'Wine' },
  {
    slug: 'street-food',
    category: 'food-drink',
    labelTr: 'Sokak lezzetleri',
    labelEn: 'Street food',
  },
  { slug: 'hiking', category: 'outdoor', labelTr: 'Doğa yürüyüşü', labelEn: 'Hiking' },
  { slug: 'camping', category: 'outdoor', labelTr: 'Kamp', labelEn: 'Camping' },
  { slug: 'sailing', category: 'outdoor', labelTr: 'Yelken', labelEn: 'Sailing' },
  { slug: 'cycling', category: 'sports', labelTr: 'Bisiklet', labelEn: 'Cycling' },
  { slug: 'running', category: 'sports', labelTr: 'Koşu', labelEn: 'Running' },
  { slug: 'yoga', category: 'sports', labelTr: 'Yoga', labelEn: 'Yoga' },
  { slug: 'gym', category: 'sports', labelTr: 'Fitness', labelEn: 'Gym' },
  { slug: 'football', category: 'sports', labelTr: 'Futbol', labelEn: 'Football' },
  { slug: 'basketball', category: 'sports', labelTr: 'Basketbol', labelEn: 'Basketball' },
  { slug: 'swimming', category: 'sports', labelTr: 'Yüzme', labelEn: 'Swimming' },
  { slug: 'jazz', category: 'music', labelTr: 'Caz', labelEn: 'Jazz' },
  { slug: 'rock', category: 'music', labelTr: 'Rock', labelEn: 'Rock' },
  { slug: 'turkish-pop', category: 'music', labelTr: 'Türkçe pop', labelEn: 'Turkish pop' },
  { slug: 'electronic', category: 'music', labelTr: 'Elektronik müzik', labelEn: 'Electronic' },
  { slug: 'concerts', category: 'music', labelTr: 'Konserler', labelEn: 'Concerts' },
  { slug: 'cinema', category: 'arts', labelTr: 'Sinema', labelEn: 'Cinema' },
  { slug: 'theatre', category: 'arts', labelTr: 'Tiyatro', labelEn: 'Theatre' },
  { slug: 'museums', category: 'arts', labelTr: 'Müzeler', labelEn: 'Museums' },
  { slug: 'photography', category: 'arts', labelTr: 'Fotoğrafçılık', labelEn: 'Photography' },
  { slug: 'reading', category: 'culture', labelTr: 'Kitap okumak', labelEn: 'Reading' },
  { slug: 'history', category: 'culture', labelTr: 'Tarih', labelEn: 'History' },
  { slug: 'languages', category: 'culture', labelTr: 'Yabancı dil', labelEn: 'Languages' },
  { slug: 'travel', category: 'lifestyle', labelTr: 'Seyahat', labelEn: 'Travel' },
  { slug: 'pets', category: 'lifestyle', labelTr: 'Evcil hayvanlar', labelEn: 'Pets' },
  { slug: 'gaming', category: 'lifestyle', labelTr: 'Oyun', labelEn: 'Gaming' },
  { slug: 'board-games', category: 'lifestyle', labelTr: 'Kutu oyunları', labelEn: 'Board games' },
  { slug: 'volunteering', category: 'lifestyle', labelTr: 'Gönüllülük', labelEn: 'Volunteering' },
  { slug: 'technology', category: 'lifestyle', labelTr: 'Teknoloji', labelEn: 'Technology' },
];

export async function seedInterests(prisma: PrismaClient): Promise<number> {
  for (const interest of INTERESTS) {
    await prisma.interest.upsert({
      where: { slug: interest.slug },
      create: interest,
      update: { category: interest.category, labelTr: interest.labelTr, labelEn: interest.labelEn },
    });
  }
  return INTERESTS.length;
}

async function main(): Promise<void> {
  loadEnvFile();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL tanımlı değil');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const count = await seedInterests(prisma);
    console.log(`İlgi alanı kataloğu güncellendi: ${count} kayıt`);
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
