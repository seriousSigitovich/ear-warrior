// Home's bottom bar: Melodies, Progress and Settings as icon + label instead of three outlined buttons,
// which saves about 50 dp of the height. The icons are Tabler outline PNGs (assets/nav, rendered by
// scripts/build-nav-icons.sh); the label always sits under the icon, so nothing is icon-only.
import React from 'react';
import { Image, ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, withAlpha } from '../../theme/nocturne';

export type NavIconKind = 'melodies' | 'progress' | 'settings';

const ICONS: Record<NavIconKind, ImageSourcePropType> = {
  melodies: require('../../../assets/nav/melodies.png'),
  progress: require('../../../assets/nav/progress.png'),
  settings: require('../../../assets/nav/settings.png'),
};

const ICON = 28;

export interface HomeNavItem {
  kind: NavIconKind;
  label: string;
  onPress: () => void;
}

export function HomeNavBar({ items }: { items: HomeNavItem[] }) {
  return (
    <View style={styles.bar}>
      {items.map((item) => (
        <Pressable
          key={item.kind}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          onPress={item.onPress}
          style={({ pressed }) => [styles.item, pressed && styles.pressed]}
        >
          <Image
            source={ICONS[item.kind]}
            style={styles.icon}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
          <Text style={styles.label}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Full-bleed under the screen's side padding, with a hairline above, like a tab bar.
  bar: {
    flexDirection: 'row',
    marginHorizontal: -24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  item: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 3 },
  pressed: { backgroundColor: withAlpha(colors.accent, 0.14) },
  icon: { width: ICON, height: ICON },
  label: { color: colors.accentRamp[400], fontSize: 11 },
});
