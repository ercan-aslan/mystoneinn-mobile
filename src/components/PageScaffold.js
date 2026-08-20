import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../theme';

/** Bounce only at real content edges; no empty-page rubber-band / leftover overscroll. */
export const SCREEN_SCROLL_PROPS = Platform.select({
  ios: {
    bounces: true,
    alwaysBounceVertical: false,
    alwaysBounceHorizontal: false,
    contentInsetAdjustmentBehavior: 'never',
  },
  android: {
    overScrollMode: 'auto',
  },
  default: {},
});

export default function PageScaffold({
  title,
  subtitle,
  loading,
  refreshing,
  error,
  onRefresh,
  children,
  headerExtra,
}) {
  const insets = useSafeAreaInsets();
  const bottomPad = 20 + Math.min(insets.bottom || 0, 12);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        {...SCREEN_SCROLL_PROPS}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
            />
          ) : undefined
        }
      >
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {headerExtra}
        {loading && !refreshing ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 32 }} />
        ) : null}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        {!(loading && !refreshing) ? children : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16 },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, marginBottom: 12 },
  errorBox: {
    backgroundColor: '#f8d7da',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  errorText: { color: COLORS.danger, fontWeight: '600' },
});
