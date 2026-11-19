import type { ProfileCardDto } from '@vibe/api-contract';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/design/components/text';
import { useTheme } from '@/design/theme';
import {
  COMMUNICATION_STYLE_OPTIONS,
  FREQUENCY_OPTIONS,
  labelOf,
  RELATIONSHIP_GOAL_OPTIONS,
} from '@/features/profile/labels';

/** Fotoğraf + kimlik başlığı. Fotoğrafın sağına/soluna dokunarak fotoğraflar arasında gezilir. */
export function CardHero({ card }: { card: ProfileCardDto }) {
  const theme = useTheme();
  const [index, setIndex] = useState(0);
  const photo = card.photos[index] ?? card.photos[0];
  const count = card.photos.length;

  return (
    <View
      style={[
        styles.hero,
        { borderRadius: theme.radii.lg, backgroundColor: theme.colors.surfaceRaised },
      ]}
    >
      {photo ? (
        <Image
          source={{ uri: photo.url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          accessibilityLabel={`${card.displayName}, fotoğraf ${index + 1} / ${count}`}
        />
      ) : null}
      {count > 1 ? (
        <>
          <View style={styles.bars} pointerEvents="none">
            {card.photos.map((p, i) => (
              <View
                key={p.id}
                style={[
                  styles.bar,
                  { backgroundColor: i === index ? theme.colors.onOverlay : theme.colors.overlay },
                ]}
              />
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Önceki fotoğraf"
            style={[styles.tapZone, { left: 0 }]}
            onPress={() => setIndex((i) => Math.max(0, i - 1))}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sonraki fotoğraf"
            style={[styles.tapZone, { right: 0 }]}
            onPress={() => setIndex((i) => Math.min(count - 1, i + 1))}
          />
        </>
      ) : null}
      <View
        style={[styles.caption, { backgroundColor: theme.colors.overlay }]}
        pointerEvents="none"
      >
        <Text variant="title" color="onOverlay">
          {card.displayName}, {card.age}
        </Text>
        <Text variant="label" color="onOverlay">
          {[card.cityName, card.distanceLabel].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </View>
  );
}

/** Kartın altındaki ayrıntılar: neden uyumlu, hakkında, bilgiler, ilgi alanları. */
export function CardDetails({ card }: { card: ProfileCardDto }) {
  const theme = useTheme();
  const facts = [
    labelOf(RELATIONSHIP_GOAL_OPTIONS, card.relationshipGoal),
    card.jobTitle,
    card.heightCm ? `${card.heightCm} cm` : null,
    card.smoking
      ? `Sigara: ${labelOf(FREQUENCY_OPTIONS, card.smoking)?.toLocaleLowerCase('tr-TR')}`
      : null,
    card.drinking
      ? `Alkol: ${labelOf(FREQUENCY_OPTIONS, card.drinking)?.toLocaleLowerCase('tr-TR')}`
      : null,
    card.exercise
      ? `Spor: ${labelOf(FREQUENCY_OPTIONS, card.exercise)?.toLocaleLowerCase('tr-TR')}`
      : null,
    card.wantsChildren == null ? null : card.wantsChildren ? 'Çocuk istiyor' : 'Çocuk istemiyor',
    labelOf(COMMUNICATION_STYLE_OPTIONS, card.communicationStyle),
  ].filter((f): f is string => Boolean(f));

  return (
    <View style={{ gap: theme.spacing.lg }}>
      {card.compatibility.reasons.length > 0 ? (
        <View
          style={[
            styles.box,
            { backgroundColor: theme.colors.surface, borderRadius: theme.radii.md },
          ]}
        >
          <Text variant="caption" color="accent">
            ORTAK NOKTALARINIZ
          </Text>
          {card.compatibility.reasons.map((reason) => (
            <Text key={reason} variant="body">
              • {reason}
            </Text>
          ))}
        </View>
      ) : null}
      {card.bio ? <Text variant="body">{card.bio}</Text> : null}
      {facts.length > 0 ? <Pills items={facts} /> : null}
      {card.interests.length > 0 ? (
        <Pills items={card.interests.map((i) => i.label)} accent />
      ) : null}
    </View>
  );
}

function Pills({ items, accent }: { items: string[]; accent?: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.pills}>
      {items.map((item) => (
        <View
          key={item}
          style={[
            styles.pill,
            {
              borderRadius: theme.radii.pill,
              borderColor: accent ? theme.colors.accentSecondary : theme.colors.border,
            },
          ]}
        >
          <Text variant="caption" color={accent ? 'accentSecondary' : 'text'}>
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', aspectRatio: 4 / 5, overflow: 'hidden', justifyContent: 'flex-end' },
  bars: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 3, borderRadius: 2 },
  tapZone: { position: 'absolute', top: 0, bottom: 90, width: '40%' },
  caption: { padding: 16, gap: 2 },
  box: { padding: 16, gap: 6 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
});
