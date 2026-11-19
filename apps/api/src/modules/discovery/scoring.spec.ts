import { compatibility, distanceLabel, goalCompatibility, type ScoringProfile } from './scoring.js';

const empty: ScoringProfile = {
  interests: [],
  relationshipGoal: null,
  smoking: null,
  drinking: null,
  exercise: null,
  wantsChildren: null,
  communicationStyle: null,
};
const ctx = { distanceKm: 10, maxDistanceKm: 50, daysSinceActive: 0 };
const coffee = { id: 1, label: 'Kahve' };
const hiking = { id: 2, label: 'Doğa yürüyüşü' };
const jazz = { id: 3, label: 'Caz' };

describe('compatibility', () => {
  it('deterministiktir', () => {
    const a = { ...empty, interests: [coffee, hiking], relationshipGoal: 'LONG_TERM' };
    const b = { ...empty, interests: [coffee, jazz], relationshipGoal: 'LONG_TERM' };
    expect(compatibility(a, b, ctx)).toEqual(compatibility(a, b, ctx));
  });

  it('ortak ilgi alanlarını ve aynı beklentiyi gerekçe olarak söyler', () => {
    const a = { ...empty, interests: [coffee, hiking], relationshipGoal: 'LONG_TERM' };
    const b = { ...empty, interests: [hiking, coffee, jazz], relationshipGoal: 'LONG_TERM' };
    const result = compatibility(a, b, ctx);
    expect(result.reasons).toContain('2 ortak ilgi alanı: Doğa yürüyüşü, Kahve');
    expect(result.reasons).toContain('İkiniz de aynı ilişki beklentisindesiniz');
  });

  it('daha çok ortak nokta → daha yüksek puan', () => {
    const base = {
      ...empty,
      interests: [coffee, hiking],
      relationshipGoal: 'LONG_TERM',
      smoking: 'NEVER',
    };
    const close = compatibility(base, { ...base }, ctx).score;
    const far = compatibility(
      base,
      { ...empty, interests: [jazz], relationshipGoal: 'SHORT_TERM', smoking: 'OFTEN' },
      ctx,
    ).score;
    expect(close).toBeGreaterThan(far);
    expect(close).toBeLessThanOrEqual(100);
    expect(far).toBeGreaterThanOrEqual(0);
  });

  it('eksik bilgi cezalandırılmaz; bileşen hesaba katılmaz', () => {
    const result = compatibility(empty, empty, {
      distanceKm: 0,
      maxDistanceKm: 50,
      daysSinceActive: 0,
    });
    expect(result.score).toBe(100); // yalnızca mesafe ve aktiflik var, ikisi de tam
    expect(result.reasons).toEqual(['Yakınında']);
  });

  it('"belirtmek istemiyorum" yaşam tarzı karşılaştırmasına girmez', () => {
    const a = { ...empty, smoking: 'PREFER_NOT_TO_SAY' };
    const b = { ...empty, smoking: 'OFTEN' };
    expect(compatibility(a, b, ctx)).toEqual(compatibility(empty, empty, ctx));
  });

  it('gerekçeler bilimsel kesinlik iddia etmez', () => {
    const a = {
      ...empty,
      interests: [coffee],
      relationshipGoal: 'LONG_TERM',
      communicationStyle: 'TEXTER',
    };
    const all = compatibility(a, a, {
      distanceKm: 1,
      maxDistanceKm: 50,
      daysSinceActive: 0,
    }).reasons.join(' ');
    expect(all).not.toMatch(/bilimsel|kanıtlanmış|garanti|%\d/i);
  });
});

it('"Yakınında" yalnızca 3 km altında söylenir (yuvarlanmış mesafeyle çelişmez)', () => {
  expect(
    compatibility(empty, empty, { distanceKm: 2.9, maxDistanceKm: 50, daysSinceActive: 0 }).reasons,
  ).toContain('Yakınında');
  expect(
    compatibility(empty, empty, { distanceKm: 4.9, maxDistanceKm: 50, daysSinceActive: 0 }).reasons,
  ).not.toContain('Yakınında');
});

describe('goalCompatibility', () => {
  it('simetrik ve sınırlı', () => {
    const goals = [
      'LONG_TERM',
      'LONG_TERM_OPEN_TO_SHORT',
      'SHORT_TERM_OPEN_TO_LONG',
      'SHORT_TERM',
      'NEW_FRIENDS',
      'NOT_SURE',
    ];
    for (const a of goals) {
      for (const b of goals) {
        const v = goalCompatibility(a, b);
        expect(v).toBe(goalCompatibility(b, a));
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
    expect(goalCompatibility('LONG_TERM', 'SHORT_TERM')).toBe(0);
  });
});

describe('distanceLabel', () => {
  it.each([
    [0.3, "2 km'den yakın"],
    [1.99, "2 km'den yakın"],
    [2.4, '2 km'],
    [12.6, '13 km'],
    [99.4, '99 km'],
    [140, '100+ km'],
  ])('%s km → %s', (km, label) => {
    expect(distanceLabel(km)).toBe(label);
  });
});
