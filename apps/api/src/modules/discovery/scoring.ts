/**
 * Deterministik ve açıklanabilir uyum puanı (brief §6, 01-MIMARI §6).
 * - Yapay zekâ sağlayıcısı yoktur; aynı girdi her zaman aynı sonucu verir.
 * - Yalnızca kullanıcıların açıkça girdiği alanlar kullanılır; hiçbir özellik tahmin edilmez.
 * - Bir bileşen için iki taraftan biri bilgi vermemişse o bileşen hesaba katılmaz (ağırlık dağıtılır).
 * - Açıklamalar "bilimsel uyum" iddia etmez; yalnızca ortak noktaları söyler.
 */

export type ScoringProfile = {
  interests: { id: number; label: string }[];
  relationshipGoal: string | null;
  smoking: string | null;
  drinking: string | null;
  exercise: string | null;
  wantsChildren: boolean | null;
  communicationStyle: string | null;
};

export type ScoringContext = {
  distanceKm: number;
  maxDistanceKm: number;
  /** Adayın son aktifliğinden bu yana geçen gün. */
  daysSinceActive: number;
};

export type Compatibility = { score: number; reasons: string[] };

export const WEIGHTS = {
  interests: 0.3,
  relationshipGoal: 0.25,
  lifestyle: 0.2,
  communication: 0.1,
  distance: 0.1,
  activity: 0.05,
} as const;

type Component = { weight: number; value: number };

const NEARBY_KM = 3;

/** İlişki beklentilerinin yakınlığı (0–1). Aynı = 1, uzun↔kısa zıt uçlar = 0. */
const GOAL_AXIS: Record<string, number> = {
  LONG_TERM: 0,
  LONG_TERM_OPEN_TO_SHORT: 1,
  SHORT_TERM_OPEN_TO_LONG: 2,
  SHORT_TERM: 3,
};

export function goalCompatibility(a: string, b: string): number {
  if (a === b) return 1;
  if (a === 'NOT_SURE' || b === 'NOT_SURE') return 0.5;
  if (a === 'NEW_FRIENDS' || b === 'NEW_FRIENDS') return 0.2;
  const [x, y] = [GOAL_AXIS[a], GOAL_AXIS[b]];
  if (x === undefined || y === undefined) return 0.5;
  return 1 - Math.abs(x - y) / 3;
}

const FREQUENCY_LEVEL: Record<string, number> = { NEVER: 0, SOMETIMES: 1, OFTEN: 2 };

function frequencyCompatibility(a: string | null, b: string | null): number | undefined {
  const [x, y] = [a ? FREQUENCY_LEVEL[a] : undefined, b ? FREQUENCY_LEVEL[b] : undefined];
  if (x === undefined || y === undefined) return undefined; // "belirtmek istemiyorum" dahil
  return 1 - Math.abs(x - y) / 2;
}

export function compatibility(
  viewer: ScoringProfile,
  candidate: ScoringProfile,
  context: ScoringContext,
): Compatibility {
  const components: Component[] = [];
  const reasons: string[] = [];

  // İlgi alanları: Jaccard benzerliği
  if (viewer.interests.length > 0 && candidate.interests.length > 0) {
    const mine = new Set(viewer.interests.map((i) => i.id));
    const shared = candidate.interests.filter((i) => mine.has(i.id));
    const union = new Set([...mine, ...candidate.interests.map((i) => i.id)]).size;
    components.push({ weight: WEIGHTS.interests, value: shared.length / union });
    if (shared.length > 0) {
      const names = shared
        .map((i) => i.label)
        .sort((a, b) => a.localeCompare(b, 'tr'))
        .slice(0, 3)
        .join(', ');
      reasons.push(`${shared.length} ortak ilgi alanı: ${names}`);
    }
  }

  // İlişki beklentisi
  if (viewer.relationshipGoal && candidate.relationshipGoal) {
    const value = goalCompatibility(viewer.relationshipGoal, candidate.relationshipGoal);
    components.push({ weight: WEIGHTS.relationshipGoal, value });
    if (value === 1) reasons.push('İkiniz de aynı ilişki beklentisindesiniz');
  }

  // Yaşam tarzı: sigara, alkol, spor, çocuk isteği (verilen alanların ortalaması)
  const lifestyle: number[] = [];
  const lifestyleMatches: string[] = [];
  for (const [key, label] of [
    ['smoking', 'sigara'],
    ['drinking', 'alkol'],
    ['exercise', 'spor'],
  ] as const) {
    const v = frequencyCompatibility(viewer[key], candidate[key]);
    if (v !== undefined) {
      lifestyle.push(v);
      if (v === 1) lifestyleMatches.push(label);
    }
  }
  if (viewer.wantsChildren !== null && candidate.wantsChildren !== null) {
    const same = viewer.wantsChildren === candidate.wantsChildren;
    lifestyle.push(same ? 1 : 0);
    if (same) lifestyleMatches.push('çocuk konusu');
  }
  if (lifestyle.length > 0) {
    components.push({
      weight: WEIGHTS.lifestyle,
      value: lifestyle.reduce((a, b) => a + b, 0) / lifestyle.length,
    });
    if (lifestyleMatches.length > 0) {
      reasons.push(`Benzer yaşam tarzı (${lifestyleMatches.join(', ')})`);
    }
  }

  // İletişim tarzı
  if (viewer.communicationStyle && candidate.communicationStyle) {
    const same = viewer.communicationStyle === candidate.communicationStyle;
    const mixed = viewer.communicationStyle === 'MIXED' || candidate.communicationStyle === 'MIXED';
    components.push({ weight: WEIGHTS.communication, value: same ? 1 : mixed ? 0.6 : 0.2 });
    if (same) reasons.push('İletişim tarzınız benziyor');
  }

  // Mesafe: yakın = yüksek
  const max = Math.max(context.maxDistanceKm, 1);
  components.push({ weight: WEIGHTS.distance, value: Math.max(0, 1 - context.distanceKm / max) });
  // Eşik, gösterilen yuvarlanmış mesafeyle çelişmeyecek kadar küçük tutulur (ör. "5 km" + "Yakınında" olmasın).
  if (context.distanceKm < NEARBY_KM) reasons.push('Yakınında');

  // Son aktiflik: 0 gün = 1, 30+ gün = 0
  components.push({
    weight: WEIGHTS.activity,
    value: Math.max(0, 1 - context.daysSinceActive / 30),
  });

  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const weighted = components.reduce((sum, c) => sum + c.weight * c.value, 0);
  return { score: Math.round((weighted / totalWeight) * 100), reasons };
}

/**
 * Kullanıcılara gösterilen mesafe: tam km'ye yuvarlanır, çok yakın ve çok uzak sınırlanır
 * (trilateration koruması, 01-MIMARI §6).
 */
export function distanceLabel(distanceKm: number): string {
  if (distanceKm < 2) return "2 km'den yakın";
  if (distanceKm >= 100) return '100+ km';
  return `${Math.round(distanceKm)} km`;
}
