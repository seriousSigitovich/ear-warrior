// Shared screen surface (Constitution III: consistent surface across the app).
// Nocturne ground: dark bg, safe-area aware, generous side padding. Screens compose
// their own kicker/heading rows in the body, matching the redesign frames.
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/nocturne';

const ALL_EDGES: Edge[] = ['top', 'bottom'];

/**
 * `edges` are the safe-area insets this screen pads for. A screen under a navigation header must
 * leave `top` out: the header already clears the status bar, and padding for it twice leaves a
 * band of dead space above the content.
 */
export function Screen({
  children,
  style,
  edges = ALL_EDGES,
}: {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  edges?: Edge[];
}) {
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <View style={[styles.container, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
});
