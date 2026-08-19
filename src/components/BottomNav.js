import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../theme';

const ICON_MAP = {
  calendar: 'calendar',
  journal: 'journal',
  'trending-up': 'trending-up',
  bed: 'bed-outline',
  star: 'star',
  pricetag: 'pricetag',
  people: 'people',
  cube: 'cube',
  wallet: 'wallet',
  cart: 'cart',
  'id-card': 'id-card',
  'bar-chart': 'bar-chart',
  images: 'images',
  ticket: 'ticket',
  compass: 'compass',
  'git-network': 'git-network',
  settings: 'settings',
  trash: 'trash',
  'shield-checkmark': 'shield-checkmark',
  'pie-chart': 'pie-chart',
  'qr-code': 'qr-code',
};

export default function BottomNav({ items, activeScreen, onNavigate, centered }) {
  const insets = useSafeAreaInsets();
  // Android 3 tuşlu / gesture bar altında kalmasın
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 8);

  return (
    <View style={[styles.wrapper, { paddingBottom: bottomPad }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.container,
          centered && styles.centered,
        ]}
      >
        {items.map((item) => {
          const active = activeScreen === item.screen;
          const isDanger = item.danger;
          const color = active
            ? '#fff'
            : isDanger
              ? COLORS.danger
              : COLORS.navInactive;

          return (
            <TouchableOpacity
              key={item.screen}
              style={[
                styles.item,
                active && (isDanger ? styles.itemActiveDanger : styles.itemActive),
              ]}
              onPress={() => onNavigate(item.screen)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={ICON_MAP[item.icon] || 'ellipse'}
                size={active ? 21 : 20}
                color={color}
              />
              <Text style={[styles.label, { color }, active && styles.labelActive]}>
                {item.title}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 8,
  },
  container: {
    paddingHorizontal: 10,
    paddingTop: 8,
    gap: 15,
    alignItems: 'center',
  },
  centered: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  item: {
    minWidth: 56,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  itemActive: {
    backgroundColor: COLORS.primary,
  },
  itemActiveDanger: {
    backgroundColor: COLORS.danger,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 3,
  },
  labelActive: {
    fontWeight: '800',
  },
});
