import type { PhotoDto, PhotoStatus } from '@vibe/api-contract';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { deletePhoto, listPhotos, reorderPhotos } from '@/api/profile';
import { Button } from '@/design/components/button';
import { Notice } from '@/design/components/notice';
import { Text } from '@/design/components/text';
import { useTheme } from '@/design/theme';
import { describeError } from '@/features/auth/error-message';

import { prepareJpeg, uploadPhoto } from './upload-photo';

export const photosQueryKey = ['photos'] as const;
const MAX_PHOTOS = 6;

const STATUS_LABEL: Partial<Record<PhotoStatus, string>> = {
  PROCESSING: 'İşleniyor',
  NEEDS_REVIEW: 'İncelemede',
  REJECTED: 'Reddedildi',
  FAILED: 'Yüklenemedi',
};

/** Onboarding adımını geçirmeye yeten durumlar (sunucudaki kuralla aynı). */
export const COUNTS_FOR_ONBOARDING: PhotoStatus[] = ['PROCESSING', 'APPROVED', 'NEEDS_REVIEW'];

export function usePhotos() {
  return useQuery({
    queryKey: photosQueryKey,
    queryFn: listPhotos,
    // İşlenen fotoğraf varken durum birkaç saniyede bir yenilenir.
    refetchInterval: (query) =>
      query.state.data?.some((p) => p.status === 'PROCESSING') ? 2_000 : false,
  });
}

export function PhotoManager() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const photos = usePhotos();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: photosQueryKey });

  const add = useMutation({
    mutationFn: async () => {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 5],
        quality: 1,
      });
      if (picked.canceled || !picked.assets[0]) return null;
      const asset = picked.assets[0];
      const jpeg = await prepareJpeg(asset.uri, asset.width, asset.height);
      return uploadPhoto(jpeg);
    },
    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: deletePhoto,
    onSuccess: () => setSelectedId(null),
    onSettled: invalidate,
  });

  const makePrimary = useMutation({
    mutationFn: (id: string) => {
      const ids = (photos.data ?? []).map((p) => p.id);
      return reorderPhotos([id, ...ids.filter((x) => x !== id)]);
    },
    onSuccess: (list) => {
      queryClient.setQueryData(photosQueryKey, list);
      setSelectedId(null);
    },
  });

  if (photos.isPending) return <ActivityIndicator color={theme.colors.accent} />;
  if (photos.isError) return <Notice message={describeError(photos.error)} />;

  const list = photos.data;
  const selected = list.find((p) => p.id === selectedId);
  const error = add.error ?? remove.error ?? makePrimary.error;
  const slots = Array.from({ length: MAX_PHOTOS }, (_, i) => list[i]);

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={styles.grid}>
        {slots.map((photo, index) =>
          photo ? (
            <PhotoTile
              key={photo.id}
              photo={photo}
              primary={index === 0}
              selected={photo.id === selectedId}
              onPress={() => setSelectedId(photo.id === selectedId ? null : photo.id)}
            />
          ) : (
            <AddTile
              key={`empty-${index}`}
              busy={add.isPending && index === list.length}
              disabled={add.isPending || index !== list.length}
              onPress={() => add.mutate()}
            />
          ),
        )}
      </View>

      {selected ? (
        <View style={{ gap: theme.spacing.sm }}>
          {selected.position !== 0 && selected.status === 'APPROVED' ? (
            <Button
              label="Ana fotoğraf yap"
              variant="secondary"
              loading={makePrimary.isPending}
              onPress={() => makePrimary.mutate(selected.id)}
            />
          ) : null}
          <Button
            label="Fotoğrafı sil"
            variant="ghost"
            loading={remove.isPending}
            onPress={() => remove.mutate(selected.id)}
          />
        </View>
      ) : null}

      {error ? <Notice message={describeError(error)} /> : null}
      {list.some((p) => p.status === 'REJECTED') ? (
        <Notice
          tone="info"
          message="Reddedilen fotoğraflar topluluk kurallarına uymadığı için kimseye gösterilmez. Silip yenisini ekleyebilirsin."
        />
      ) : null}
    </View>
  );
}

function PhotoTile({
  photo,
  primary,
  selected,
  onPress,
}: {
  photo: PhotoDto;
  primary: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const status = STATUS_LABEL[photo.status];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${primary ? 'Ana fotoğraf' : `Fotoğraf ${photo.position + 1}`}${status ? `, ${status}` : ''}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.tile,
        {
          borderRadius: theme.radii.md,
          backgroundColor: theme.colors.surfaceRaised,
          borderColor: selected ? theme.colors.accent : 'transparent',
        },
      ]}
    >
      {photo.url ? (
        <Image source={{ uri: photo.url }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <ActivityIndicator color={theme.colors.accent} />
      )}
      {status ? (
        <View
          style={[
            styles.badge,
            {
              backgroundColor:
                photo.status === 'REJECTED' || photo.status === 'FAILED'
                  ? theme.colors.danger
                  : theme.colors.overlay,
            },
          ]}
        >
          <Text variant="caption" color="onOverlay">
            {status}
          </Text>
        </View>
      ) : null}
      {primary ? (
        <View style={[styles.primary, { backgroundColor: theme.colors.accent }]}>
          <Text variant="caption" color="onAccent">
            Ana
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function AddTile({
  onPress,
  disabled,
  busy,
}: {
  onPress: () => void;
  disabled: boolean;
  busy: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Fotoğraf ekle"
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.tile,
        styles.add,
        {
          borderRadius: theme.radii.md,
          borderColor: theme.colors.border,
          opacity: disabled && !busy ? 0.4 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={theme.colors.accent} />
      ) : (
        <Text variant="title" color="accent">
          +
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '31%',
    aspectRatio: 4 / 5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  add: { borderStyle: 'dashed' },
  badge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 6,
    borderRadius: 6,
    paddingVertical: 3,
    alignItems: 'center',
  },
  primary: {
    position: 'absolute',
    top: 6,
    left: 6,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});
