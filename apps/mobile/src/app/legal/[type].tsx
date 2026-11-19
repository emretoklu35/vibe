import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { getLegalDocument } from '@/api/account';
import { Button } from '@/design/components/button';
import { Screen } from '@/design/components/screen';
import { Text } from '@/design/components/text';
import { useTheme } from '@/design/theme';
import { LoadingView, UnreachableView } from '@/features/session/status-views';

/** Hukuki metinler sade markdown'dır: paragraf, "- " madde, "> " not ve **kalın** desteklenir. */
function renderBlocks(body: string) {
  return body.split('\n').map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return { kind: 'space' as const, text: '' };
    const text = trimmed.replace(/\*\*/g, '');
    if (trimmed.startsWith('> ')) return { kind: 'note' as const, text: text.slice(2) };
    if (trimmed.startsWith('- ')) return { kind: 'bullet' as const, text: text.slice(2) };
    return { kind: 'paragraph' as const, text };
  });
}

export default function LegalDocumentScreen() {
  const theme = useTheme();
  const { type } = useLocalSearchParams<{ type: string }>();
  const doc = useQuery({ queryKey: ['legal', type], queryFn: () => getLegalDocument(type) });

  if (doc.isPending) return <LoadingView />;
  if (doc.isError)
    return <UnreachableView onRetry={() => void doc.refetch()} busy={doc.isFetching} />;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingVertical: theme.spacing.xxl, gap: theme.spacing.md }}
      >
        <Text variant="title" accessibilityRole="header">
          {doc.data.title}
        </Text>
        <Text variant="caption" color="textMuted">
          Sürüm: {doc.data.version}
        </Text>
        {renderBlocks(doc.data.body).map((block, index) =>
          block.kind === 'space' ? (
            <View key={index} style={{ height: theme.spacing.xs }} />
          ) : (
            <Text
              key={index}
              variant={block.kind === 'note' ? 'label' : 'body'}
              color={block.kind === 'note' ? 'accent' : 'text'}
            >
              {block.kind === 'bullet' ? `•  ${block.text}` : block.text}
            </Text>
          ),
        )}
      </ScrollView>
      <View style={{ paddingVertical: theme.spacing.lg }}>
        <Button label="Kapat" variant="secondary" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
