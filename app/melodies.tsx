// Melodies: the whole library to choose from, level by level. Each tune is named and says what it asks
// before it is started (notes, phrases, tempo) and how the learner did on it; any of them can be played
// at any time — an old one again, or one further up without waiting for the level to get there.
import React, { useMemo } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../src/components/common/Screen';
import { Kicker } from '../src/components/common/Kicker';
import { useHistory } from '../src/features/progress/useHistory';
import { CatalogTune, libraryCatalog, tuneAsk } from '../src/services/melody/catalog';
import { colors, font, radius, textAlpha, withAlpha } from '../src/theme/nocturne';

function TuneRow({ tune, onPress }: { tune: CatalogTune; onPress: () => void }) {
  const status = tune.bestPct === null ? 'New' : `${tune.bestPct}%`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${tune.name}. ${tuneAsk(tune)}. ${
        tune.bestPct === null ? 'Not played yet' : `Best score ${tune.bestPct} percent`
      }`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={1}>
          {tune.name}
        </Text>
        <Text style={styles.ask}>{tuneAsk(tune)}</Text>
      </View>
      <Text
        style={[
          styles.status,
          tune.bestPct === null && styles.statusNew,
          tune.bestPct === 100 && styles.statusPerfect,
        ]}
      >
        {status}
      </Text>
    </Pressable>
  );
}

export default function Melodies() {
  const router = useRouter();
  const { attempts } = useHistory();
  const sections = useMemo(
    () =>
      libraryCatalog(attempts).map((level) => ({
        rank: level.rank,
        played: level.played,
        total: level.tunes.length,
        data: level.tunes,
      })),
    [attempts],
  );

  return (
    <Screen edges={['bottom']} style={styles.screen}>
      <SectionList
        sections={sections}
        keyExtractor={(t) => t.id}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.head}>
            <Kicker>Library</Kicker>
            <Text style={styles.title}>Melodies</Text>
            <Text style={styles.lead}>
              Play any melody, in any order: go back to an old one or jump ahead.
            </Text>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Level {section.rank}</Text>
            <Text style={styles.sectionCount}>
              {section.played} of {section.total} played
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TuneRow
            tune={item}
            onPress={() => router.push({ pathname: '/practice', params: { tune: item.id } })}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  head: { marginBottom: 6 },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: font.weightHeading,
    marginTop: 6,
    marginBottom: 8,
  },
  lead: { color: textAlpha[65], fontSize: 14, lineHeight: 21 },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 22,
    marginBottom: 10,
  },
  sectionTitle: {
    color: colors.accent,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionCount: { color: textAlpha[50], fontSize: 12 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  rowPressed: { backgroundColor: withAlpha(colors.accent, 0.14) },
  rowText: { flex: 1, gap: 3 },
  name: { color: colors.text, fontSize: 15, fontWeight: font.weightHeading },
  ask: { color: textAlpha[55], fontSize: 12 },
  status: { color: colors.warm, fontSize: 14, fontWeight: font.weightHeading },
  statusNew: { color: textAlpha[45], fontWeight: '400' },
  statusPerfect: { color: colors.accent },
  gap: { height: 8 },
});
