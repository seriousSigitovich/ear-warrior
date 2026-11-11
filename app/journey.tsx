// Musical Journey (spec 013): the seven ranks and the nine levels on one screen. A rank is unlocked
// by XP and mastered levels together, so each rank shows both requirements and which are met; each
// level shows how far its mastery has come (melodies completed, recent accuracy, melodies without
// hints), because that is what gates the ranks.
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { GAMIFICATION } from '../src/config/gamification';
import { Card } from '../src/components/common/Card';
import { Kicker } from '../src/components/common/Kicker';
import { Screen } from '../src/components/common/Screen';
import { RankCard } from '../src/components/progress/RankCard';
import { useGamification } from '../src/features/gamification/useGamification';
import { levelLabel, masteryRequirement } from '../src/lib/levelLabels';
import { LevelStatus } from '../src/services/gamification/service';
import { colors, font, textAlpha } from '../src/theme/nocturne';

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function LevelRow({ level }: { level: LevelStatus }) {
  const { needs } = level;
  const left: string[] = [];
  if (needs.average.have < needs.average.need && level.completed >= needs.completed.need) {
    left.push(`recent average ${needs.average.have}% of ${needs.average.need}%`);
  }
  if (needs.withoutHints.have < needs.withoutHints.need) {
    left.push(`${needs.withoutHints.have} of ${needs.withoutHints.need} without hints`);
  }
  const pct = Math.min(100, Math.round((level.completed / needs.completed.need) * 100));
  return (
    <View
      style={styles.levelRow}
      accessible
      accessibilityLabel={`${levelLabel(level.level)}: ${
        level.mastered ? 'mastered' : `${level.completed} of ${needs.completed.need} melodies`
      }`}
    >
      <View style={styles.levelHead}>
        <Text style={styles.levelName}>{levelLabel(level.level)}</Text>
        <Text style={[styles.levelState, level.mastered && styles.mastered]}>
          {level.mastered
            ? `✓ Mastered${level.achievedAt ? ` · ${day(level.achievedAt)}` : ''}`
            : `${level.completed} of ${needs.completed.need} melodies`}
        </Text>
      </View>
      <View style={styles.bar}>
        <View style={[styles.fill, { width: `${level.mastered ? 100 : pct}%` }]} />
      </View>
      {!level.mastered && left.length > 0 && level.completed > 0 ? (
        <Text style={styles.levelNeed}>Still needs: {left.join(' · ')}</Text>
      ) : null}
    </View>
  );
}

export default function Journey() {
  const snap = useGamification();
  const ranks = GAMIFICATION.ranks;
  const mastered = new Set(snap?.mastery.filter((m) => m.mastered).map((m) => m.level) ?? []);

  return (
    <Screen edges={['bottom']}>
      <Kicker>Musical journey</Kicker>
      <Text style={styles.title}>Ranks</Text>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {snap ? (
          <>
            <RankCard rank={snap.rank} />

            <Text style={styles.section}>All ranks</Text>
            {ranks.map((r, i) => {
              const reached = i <= snap.rank.index;
              const current = i === snap.rank.index;
              const xpMet = snap.totalXp >= r.requiredXp;
              const missing = r.requiredMastery.filter((l) => !mastered.has(l));
              return (
                <Card
                  key={r.id}
                  style={[
                    styles.rank,
                    current ? styles.current : {},
                    !reached ? styles.locked : {},
                  ]}
                  accessible
                  accessibilityLabel={`${r.name}. ${reached ? (current ? 'Current rank' : 'Unlocked') : 'Locked'}. ${r.requiredXp} XP. ${masteryRequirement(r.requiredMastery)}`}
                >
                  <View style={styles.rankHead}>
                    <Text style={[styles.rankName, !reached && styles.lockedText]}>
                      {reached ? (current ? '● ' : '✓ ') : '🔒 '}
                      {r.name}
                    </Text>
                    {current ? <Text style={styles.here}>You are here</Text> : null}
                  </View>
                  <Text style={styles.req}>
                    <Text style={xpMet ? styles.met : undefined}>{r.requiredXp} XP</Text>
                    {' · '}
                    <Text style={missing.length === 0 ? styles.met : undefined}>
                      {masteryRequirement(r.requiredMastery)}
                    </Text>
                  </Text>
                </Card>
              );
            })}

            <Text style={styles.section}>Levels</Text>
            <Card style={styles.levels}>
              {snap.mastery.map((m) => (
                <LevelRow key={m.level} level={m} />
              ))}
            </Card>
            <Text style={styles.note}>
              A level is mastered after {GAMIFICATION.mastery.minCompleted} melodies of it,
              averaging {GAMIFICATION.mastery.minRecentAverage}% over the last{' '}
              {GAMIFICATION.mastery.recentWindow}, with {GAMIFICATION.mastery.minWithoutHints}{' '}
              played without hints.
            </Text>
          </>
        ) : (
          <Text style={styles.muted}>Loading…</Text>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: font.weightHeading,
    marginTop: 6,
    marginBottom: 20,
  },
  scroll: { flex: 1 },
  body: { gap: 10, paddingBottom: 24 },
  muted: { color: textAlpha[65], fontSize: 14 },
  section: {
    color: colors.accent,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 14,
  },
  rank: { padding: 14, gap: 4, borderWidth: 1, borderColor: 'transparent' },
  current: { borderColor: colors.accent },
  locked: { opacity: 0.7 },
  rankHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  rankName: { color: colors.text, fontSize: 16, fontWeight: font.weightHeading },
  lockedText: { color: textAlpha[65] },
  here: { color: colors.accentRamp[300], fontSize: 12 },
  req: { color: textAlpha[55], fontSize: 12 },
  met: { color: colors.accentRamp[300] },
  levels: { padding: 14, gap: 14 },
  levelRow: { gap: 6 },
  levelHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  levelName: { color: colors.text, fontSize: 14, fontWeight: font.weightHeading },
  levelState: { color: textAlpha[55], fontSize: 12 },
  mastered: { color: colors.accentRamp[300] },
  bar: { height: 5, borderRadius: 3, backgroundColor: colors.divider, overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3, backgroundColor: colors.accent },
  levelNeed: { color: textAlpha[45], fontSize: 11 },
  note: { color: textAlpha[45], fontSize: 12, lineHeight: 18 },
});
