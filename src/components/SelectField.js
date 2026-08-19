import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { COLORS, INPUT_FONT_SIZE, INPUT_MIN_HEIGHT } from '../theme';
import AppPressable from './AppPressable';
export default function SelectField({ label, value, options = [], onChange, placeholder = 'Seçin...' }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => String(o.value) === String(value));

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable style={styles.field} onPress={() => setOpen(true)}>
        <Text style={selected ? styles.value : styles.placeholder}>
          {selected ? selected.label : placeholder}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.sheetTitle}>{label || placeholder}</Text>
            <ScrollView style={styles.optionsList} keyboardShouldPersistTaps="handled">
              {options.length === 0 ? (
                <Text style={styles.emptyOption}>Seçenek yok</Text>
              ) : (
                options.map((opt) => (
                  <Pressable
                    key={String(opt.value)}
                    style={[styles.option, String(opt.value) === String(value) && styles.optionActive]}
                    onPress={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        String(opt.value) === String(value) && styles.optionTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export function SubmitButton({ title, color, loading, disabled, onPress, style }) {
  return (
    <AppPressable
      title={title}
      color={color || COLORS.primary}
      loading={loading}
      disabled={disabled}
      onPress={onPress}
      style={[styles.submitBtnWrap, style]}
    />
  );
}
const styles = StyleSheet.create({
  wrap: { marginBottom: 4 },
  label: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 4, marginTop: 6 },
  field: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    minHeight: INPUT_MIN_HEIGHT,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : null),
  },
  placeholder: { fontSize: INPUT_FONT_SIZE, color: COLORS.textMuted },
  value: { fontSize: INPUT_FONT_SIZE, color: COLORS.textPrimary, fontWeight: '600' },
  chevron: { color: COLORS.textMuted, fontSize: 12 },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    ...(Platform.OS === 'web' ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999 } : null),
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '60%',
    paddingBottom: 24,
    ...(Platform.OS === 'web' ? { zIndex: 100000 } : null),
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    color: COLORS.textPrimary,
  },
  optionsList: { maxHeight: 320 },
  option: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  optionActive: { backgroundColor: '#e7f1ff' },
  optionText: { fontSize: 15, color: COLORS.textPrimary },
  optionTextActive: { color: COLORS.primary, fontWeight: '700' },
  emptyOption: { padding: 16, color: COLORS.textMuted, textAlign: 'center' },
  submitBtnWrap: { marginTop: 10, width: '100%' },
  submitBtn: {
    borderRadius: 6,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 10,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : null),
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
