import type { CommunicationStyle, Frequency, Gender, RelationshipGoal } from '@vibe/api-contract';

type Options<T extends string> = readonly { value: T; label: string }[];

export const GENDER_OPTIONS: Options<Gender> = [
  { value: 'WOMAN', label: 'Kadın' },
  { value: 'MAN', label: 'Erkek' },
  { value: 'NON_BINARY', label: 'Non-binary' },
  { value: 'OTHER', label: 'Diğer' },
];

export const RELATIONSHIP_GOAL_OPTIONS: Options<RelationshipGoal> = [
  { value: 'LONG_TERM', label: 'Uzun süreli ilişki' },
  { value: 'LONG_TERM_OPEN_TO_SHORT', label: 'Uzun süreli, kısa da olabilir' },
  { value: 'SHORT_TERM_OPEN_TO_LONG', label: 'Kısa süreli, uzun da olabilir' },
  { value: 'SHORT_TERM', label: 'Kısa süreli' },
  { value: 'NEW_FRIENDS', label: 'Yeni arkadaşlar' },
  { value: 'NOT_SURE', label: 'Henüz emin değilim' },
];

export const FREQUENCY_OPTIONS: Options<Frequency> = [
  { value: 'NEVER', label: 'Hiç' },
  { value: 'SOMETIMES', label: 'Bazen' },
  { value: 'OFTEN', label: 'Sık' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Belirtmek istemiyorum' },
];

export const COMMUNICATION_STYLE_OPTIONS: Options<CommunicationStyle> = [
  { value: 'TEXTER', label: 'Mesajlaşmayı severim' },
  { value: 'CALLER', label: 'Telefonda konuşmayı severim' },
  { value: 'IN_PERSON', label: 'Yüz yüze görüşmeyi severim' },
  { value: 'MIXED', label: 'Karışık' },
];

export const DISTANCE_OPTIONS = [10, 25, 50, 100, 200].map((km) => ({
  value: km,
  label: `${km} km`,
}));

export const labelOf = <T extends string>(options: Options<T>, value: T | null | undefined) =>
  options.find((o) => o.value === value)?.label;
