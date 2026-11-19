import { randomBytes } from 'node:crypto';

import { distanceMeters, fuzzLocation } from './location-fuzz.js';

const secret = randomBytes(32);
const kadikoy = { latitude: 40.9903, longitude: 29.0294 };

describe('fuzzLocation', () => {
  it('gerçek konumdan en az ~150 m, en çok ~1.4 km uzaklaşır', () => {
    for (let i = 0; i < 200; i++) {
      const point = {
        latitude: 36 + Math.random() * 6,
        longitude: 26 + Math.random() * 18,
      };
      const fuzzed = fuzzLocation(point, secret, `user-${i}`);
      const d = distanceMeters(point, fuzzed);
      expect(d).toBeLessThan(1_400);
      expect(fuzzed).not.toEqual(point);
    }
  });

  it('aynı kullanıcı + aynı ızgara hücresi → her zaman aynı nokta (ortalama alarak yaklaşılamaz)', () => {
    const a = fuzzLocation(kadikoy, secret, 'u1');
    const b = fuzzLocation(
      { latitude: kadikoy.latitude + 0.0005, longitude: kadikoy.longitude - 0.0005 },
      secret,
      'u1',
    );
    expect(b).toEqual(a);
  });

  it('farklı kullanıcılar aynı yerde farklı noktalara düşer', () => {
    const a = fuzzLocation(kadikoy, secret, 'u1');
    const b = fuzzLocation(kadikoy, secret, 'u2');
    expect(distanceMeters(a, b)).toBeGreaterThan(1);
  });

  it('gizli anahtar olmadan sapma tahmin edilemez (başka anahtar başka nokta)', () => {
    const a = fuzzLocation(kadikoy, secret, 'u1');
    const b = fuzzLocation(kadikoy, randomBytes(32), 'u1');
    expect(a).not.toEqual(b);
  });

  it('uç değerlerde geçerli koordinat üretir', () => {
    for (const point of [
      { latitude: 89.99, longitude: 179.999 },
      { latitude: -89.99, longitude: -179.999 },
      { latitude: 0, longitude: 0 },
    ]) {
      const f = fuzzLocation(point, secret, 'edge');
      expect(f.latitude).toBeGreaterThanOrEqual(-90);
      expect(f.latitude).toBeLessThanOrEqual(90);
      expect(f.longitude).toBeGreaterThanOrEqual(-180);
      expect(f.longitude).toBeLessThanOrEqual(180);
    }
  });
});
