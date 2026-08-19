import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PageScaffold from '../components/PageScaffold';
import CalendarGrid from '../components/CalendarGrid';
import CalendarLegend from '../components/CalendarLegend';
import FormCard, { FormInput, FormLabel } from '../components/FormCard';
import DateInput from '../components/DateInput';
import SelectField, { SubmitButton } from '../components/SelectField';
import AppPressable, { DeleteButton } from '../components/AppPressable';
import { CalendarAPI, fetchReservationMetaForGrid, RoomsAPI } from '../api';
import { useAppNavigation } from '../context/NavigationContext';
import { useFetch } from '../hooks/useFetch';
import { COLORS } from '../theme';
import { showMessage } from '../utils/alert';
import ActionFeedback from '../components/ActionFeedback';
import { addDaysIso, enrichCalendarGrid, formatDate, nightsBetweenIso, overlayPendingHoldsOnGrid } from '../utils/format';
import { subscribeCalendarRefresh, registerCalendarReload } from '../utils/calendarRefresh';
import { syncCalendarBaselineFromResponse, STORAGE_CALENDAR_START_KEY } from '../services/reservationWatcher';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CalendarSummaryScreen from './CalendarSummaryScreen';
import BulkUpdateModal from '../components/BulkUpdateModal';

function StatBox({ label, value, bg, icon, onPress, textDark = false }) {
  const content = (
    <>
      <Text style={[styles.statLabel, textDark && styles.statLabelDark]}>{label}</Text>
      <Text style={[styles.statValue, textDark && styles.statValueDark]}>{value}</Text>
      {icon ? <Text style={styles.statIcon}>{icon}</Text> : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.statBox, { backgroundColor: bg }]}>
        {content}
      </View>
    );
  }

  return (
    <Pressable style={[styles.statBox, { backgroundColor: bg }]} onPress={onPress}>
      {content}
    </Pressable>
  );
}

const emptyRes = { room_id: '', check_in: '', check_out: '', guest_name: '', total_price: '' };
const emptyAvail = { room_id: '', start_date: '', end_date: '', price_eur: '', status: 'open' };
const emptyBlock = { room_id: '', check_in: '', check_out: '', summary: '' };

function findReservationSnapshot(grid, rooms, reservationId) {
  const targetId = Number(reservationId);
  if (!targetId) return null;

  for (const room of rooms || []) {
    const roomId = Number(room.room_id);
    const row = grid?.[roomId] || {};
    for (const cell of Object.values(row)) {
      if (cell?.type === 'reservation' && Number(cell.reservation_id) === targetId) {
        return {
          reservation_id: targetId,
          guest_name: cell.guest_name || cell.label,
          channel: cell.channel,
          room_id: roomId,
          room_name: room.room_name,
          check_in: cell.check_in || '',
          check_out: cell.check_out || '',
          status: cell.status || 'confirmed',
          total_price: Number(cell.total_price || 0),
          note: cell.note || '',
        };
      }
    }
  }
  return null;
}

export default function CalendarScreen() {
  const { openReservation, navigateTo } = useAppNavigation();
  const [startDate, setStartDate] = useState(null);
  const [resForm, setResForm] = useState(emptyRes);
  const [availForm, setAvailForm] = useState(emptyAvail);
  const [blockForm, setBlockForm] = useState(emptyBlock);
  const [bulkModalVisible, setBulkModalVisible] = useState(false);
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState({ message: '', type: 'info' });
  const [fallbackRooms, setFallbackRooms] = useState([]);
  const [summaryTab, setSummaryTab] = useState(null);

  const loader = useCallback(async () => {
    const calRes = await CalendarAPI.get(startDate || undefined);
    const cal = calRes.data || calRes;
    const meta = await fetchReservationMetaForGrid(cal?.grid || {}, cal?.reservation_meta);
    const overlaid = overlayPendingHoldsOnGrid(cal?.grid || {}, cal?.reservation_meta || meta, cal?.days || []);
    const grid = enrichCalendarGrid(overlaid, meta);
    await syncCalendarBaselineFromResponse({
      ...cal,
      grid: cal?.grid || {},
      reservation_meta: cal?.reservation_meta || meta,
      calendar_revision: cal?.calendar_revision,
    });
    await AsyncStorage.setItem(STORAGE_CALENDAR_START_KEY, cal?.start_date || startDate || '');
    return {
      ...cal,
      grid,
    };
  }, [startDate]);

  const { data: cal, loading, refreshing, error, refresh, reloadQuiet } = useFetch(loader);
  const stats = cal?.stats || {};
  const cokluCount = stats.coklu_rezervasyon ?? stats.conflicts ?? 0;
  const todayNew = stats.today_new_reservations ?? 0;
  const rooms = cal?.rooms?.length ? cal.rooms : fallbackRooms;
  const displayGrid = cal?.grid || {};

  useEffect(() => {
    const unregister = registerCalendarReload(() => reloadQuiet());
    const unsubscribe = subscribeCalendarRefresh(() => reloadQuiet());
    return () => {
      unregister();
      unsubscribe();
    };
  }, [reloadQuiet]);

  useEffect(() => {
    if (cal?.rooms?.length || fallbackRooms.length) return;
    RoomsAPI.list()
      .then((res) => {
        const list = res?.data || res?.rooms || [];
        if (Array.isArray(list) && list.length) {
          setFallbackRooms(list);
        }
      })
      .catch(() => {});
  }, [cal?.rooms, fallbackRooms.length]);

  const roomOptions = useMemo(
    () => rooms.map((r) => ({ value: r.room_id, label: r.room_name })),
    [rooms]
  );

  const statusOptions = [
    { value: 'open', label: 'Açık' },
    { value: 'closed', label: 'Kapalı' },
  ];

  const runAction = async (key, payload, onSuccess) => {
    setBusy(key);
    setFeedback({ message: '', type: 'info' });
    try {
      await CalendarAPI.action(payload);
      setFeedback({ message: 'İşlem kaydedildi.', type: 'success' });
      showMessage('Başarılı', 'İşlem kaydedildi.');
      onSuccess?.();
      refresh();
    } catch (err) {
      const msg = err.message || 'İşlem başarısız.';
      setFeedback({ message: msg, type: 'error' });
      showMessage('Hata', msg);
    } finally {
      setBusy('');
    }
  };

  const onSync = async () => {
    setBusy('sync');
    setFeedback({ message: '', type: 'info' });
    try {
      await CalendarAPI.action({ action: 'sync' });
      refresh();
    } catch (err) {
      const msg = err.message || 'Senkronizasyon başarısız.';
      setFeedback({ message: msg, type: 'error' });
      showMessage('Hata', msg);
    } finally {
      setBusy('');
    }
  };

  const isRangeAvailable = (roomId, checkIn, checkOut) => {
    if (!checkIn || !checkOut || checkOut <= checkIn) return true;
    const rid = String(roomId);
    const grid = displayGrid || {};
    let cursor = checkIn;
    while (cursor < checkOut) {
      const cell = grid[rid]?.[cursor] || grid[roomId]?.[cursor];
      if (!cell || cell.type !== 'open') return false;
      cursor = addDaysIso(cursor, 1);
    }
    return true;
  };

  const onSaveReservation = () => {
    if (!resForm.room_id || !resForm.check_in || !resForm.check_out || !resForm.guest_name) {
      const msg = 'Oda, tarihler (GG/AA/YYYY) ve misafir adı zorunludur.';
      setFeedback({ message: msg, type: 'error' });
      showMessage('Eksik alan', msg);
      return;
    }
    if (!isRangeAvailable(resForm.room_id, resForm.check_in, resForm.check_out)) {
      const msg = 'Seçilen tarihler arasında dolu veya kapalı gün var.';
      setFeedback({ message: msg, type: 'error' });
      showMessage('Müsait değil', msg);
      return;
    }
    runAction(
      'res',
      {
        action: 'create_manual_reservation',
        room_id: Number(resForm.room_id),
        check_in: resForm.check_in,
        check_out: resForm.check_out,
        guest_name: resForm.guest_name,
        total_price: Number(resForm.total_price || 0),
      },
      () => setResForm(emptyRes)
    );
  };

  const onSaveAvailability = () => {
    if (!availForm.room_id || !availForm.start_date || !availForm.end_date) {
      const msg = 'Oda ve tarih aralığı zorunludur.';
      setFeedback({ message: msg, type: 'error' });
      showMessage('Eksik alan', msg);
      return;
    }
    runAction(
      'avail',
      {
        action: 'availability',
        room_id: Number(availForm.room_id),
        start_date: availForm.start_date,
        end_date: availForm.end_date,
        price_eur: Number(availForm.price_eur || 0),
        status: availForm.status,
      },
      () => setAvailForm(emptyAvail)
    );
  };

  const onSaveBlock = () => {
    if (!blockForm.room_id || !blockForm.check_in || !blockForm.check_out) {
      const msg = 'Oda ve tarihler zorunludur.';
      setFeedback({ message: msg, type: 'error' });
      showMessage('Eksik alan', msg);
      return;
    }
    runAction(
      'block',
      {
        action: 'create_manual_block',
        room_id: Number(blockForm.room_id),
        check_in: blockForm.check_in,
        check_out: blockForm.check_out,
        summary: blockForm.summary || 'Blokaj',
      },
      () => setBlockForm(emptyBlock)
    );
  };

  const onDeleteBlock = (blockId) => {
    runAction('del', { action: 'delete_block', block_id: blockId });
  };

  const onSaveBulk = (payload) => {
    runAction(
      'bulk',
      { action: 'bulk_update', ...payload },
      () => setBulkModalVisible(false)
    );
  };

  const onCellPress = (roomId, date, cell) => {
    if (cell?.type !== 'open') {
      showMessage('Müsait değil', 'Sadece müsait (fiyatlı) günler seçilebilir.');
      return;
    }

    setResForm((prev) => {
      const sameRoom = prev.room_id && String(prev.room_id) === String(roomId);
      const hasCompleteRange = prev.check_in && prev.check_out;

      if (!sameRoom || hasCompleteRange) {
        return { ...prev, room_id: roomId, check_in: date, check_out: '' };
      }

      if (!prev.check_out) {
        if (date === prev.check_in) {
          const checkOut = addDaysIso(date, 1);
          if (!isRangeAvailable(roomId, date, checkOut)) {
            showMessage('Müsait değil', 'Seçilen aralıkta dolu veya kapalı gün var.');
            return { ...prev, room_id: roomId, check_in: date, check_out: '' };
          }
          return { ...prev, room_id: roomId, check_out: checkOut };
        }

        if (date < prev.check_in) {
          return { ...prev, room_id: roomId, check_in: date, check_out: '' };
        }

        if (!isRangeAvailable(roomId, prev.check_in, date)) {
          showMessage('Müsait değil', 'Giriş ile çıkış arasında dolu veya kapalı gün var.');
          return { ...prev, room_id: roomId, check_in: date, check_out: '' };
        }

        return { ...prev, room_id: roomId, check_out: date };
      }

      return prev;
    });
  };

  const calendarSelection = {
    roomId: resForm.room_id,
    checkIn: resForm.check_in,
    checkOut: resForm.check_out,
  };

  const goPrev = () => setStartDate(cal?.prev_date || null);
  const goNext = () => setStartDate(cal?.next_date || null);
  const goToday = () => setStartDate(null);
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screenRoot}>
    <PageScaffold loading={loading} refreshing={refreshing} error={error} onRefresh={refresh}>
      <ActionFeedback
        message={feedback.message}
        type={feedback.type}
        onClear={() => setFeedback({ message: '', type: 'info' })}
      />
      <View style={styles.statsRow}>
        <StatBox
          label="GİRİŞ"
          value={String(stats.today_checkins ?? 0)}
          bg={COLORS.success}
          onPress={() => setSummaryTab('giris')}
        />
        <StatBox
          label="ÇIKIŞ"
          value={String(stats.today_checkouts ?? 0)}
          bg={COLORS.info}
          onPress={() => setSummaryTab('cikis')}
        />
        <StatBox
          label="BUGÜN GELEN"
          value={String(todayNew)}
          bg="#ffc107"
          textDark
          onPress={() => setSummaryTab('yeni')}
        />
        <StatBox
          label="ÇOKLU REZ."
          value={cokluCount > 0 ? String(cokluCount) : 'Yok'}
          bg={cokluCount > 0 ? COLORS.danger : COLORS.success}
          icon={cokluCount > 0 ? null : '🛡'}
          onPress={() => setSummaryTab('coklu')}
        />
      </View>

      <View style={styles.syncBar}>
        <AppPressable color={COLORS.textSecondary} onPress={goPrev} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={18} color="#fff" />
        </AppPressable>

        <View style={styles.syncCenter}>
          {!cal?.is_today_view ? (
            <Pressable onPress={goToday} style={styles.todayBadge}>
              <Text style={styles.todayBadgeText}>Bugüne Dön</Text>
            </Pressable>
          ) : null}
          <Text style={styles.syncLabel}>
            Son Senkron: <Text style={styles.syncValue}>{cal?.last_sync || '—'}</Text>
          </Text>
          <View style={styles.syncActions}>
            <AppPressable
              color={COLORS.success}
              loading={busy === 'sync'}
              disabled={busy === 'sync'}
              onPress={onSync}
              style={styles.syncBtn}
            >
              <View style={styles.syncBtnInner}>
                <Ionicons name="refresh" size={12} color="#fff" />
                <Text style={styles.syncBtnText}>
                  {busy === 'sync' ? ' Senkronize...' : ' Senkronize Et'}
                </Text>
              </View>
            </AppPressable>
            <AppPressable
              color={COLORS.warning}
              onPress={() => setBulkModalVisible(true)}
              style={styles.bulkBtn}
            >
              <Text style={styles.bulkBtnText}>📦 Toplu Güncelle</Text>
            </AppPressable>
          </View>
        </View>

        <AppPressable color={COLORS.textSecondary} onPress={goNext} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={18} color="#fff" />
        </AppPressable>
      </View>

      <CalendarLegend />

      <CalendarGrid
        days={cal?.days || []}
        rooms={rooms}
        grid={displayGrid}
        dayState={cal?.day_state || {}}
        onCellPress={onCellPress}
        onReservationPress={(id) =>
          openReservation(id, findReservationSnapshot(displayGrid, rooms, id))
        }
        selection={calendarSelection}
      />

      <FormCard title="Rezervasyon ekle" icon="👤" borderColor={COLORS.primary}>
        {(resForm.room_id && resForm.check_in) ? (
          <View style={styles.selectedSummary}>
            <Text style={styles.selectedSummaryText}>
              {roomOptions.find((r) => String(r.value) === String(resForm.room_id))?.label || 'Oda'}{' '}
              · {resForm.check_in ? formatDate(resForm.check_in) : '—'}
              {resForm.check_out ? ` → ${formatDate(resForm.check_out)}` : ' → çıkış seçin'}
              {resForm.check_in && resForm.check_out
                ? ` (${nightsBetweenIso(resForm.check_in, resForm.check_out)} gece)`
                : ''}
            </Text>
          </View>
        ) : null}
        <SelectField
          placeholder="Oda Seçin..."
          value={resForm.room_id}
          options={roomOptions}
          onChange={(v) => setResForm((p) => ({ ...p, room_id: v }))}
        />
        <View style={styles.row2}>
          <View style={styles.half}>
            <FormLabel>Giriş</FormLabel>
            <DateInput
              value={resForm.check_in}
              onChangeValue={(v) => setResForm((p) => ({ ...p, check_in: v }))}
            />
          </View>
          <View style={styles.half}>
            <FormLabel>Çıkış</FormLabel>
            <DateInput
              value={resForm.check_out}
              onChangeValue={(v) => setResForm((p) => ({ ...p, check_out: v }))}
            />
          </View>
        </View>
        <View style={styles.row2}>
          <View style={[styles.half, { flex: 1.4 }]}>
            <FormInput
              placeholder="Misafir Adı"
              value={resForm.guest_name}
              onChangeText={(v) => setResForm((p) => ({ ...p, guest_name: v }))}
            />
          </View>
          <View style={styles.half}>
            <FormInput
              placeholder="Tutar (€)"
              keyboardType="decimal-pad"
              value={resForm.total_price}
              onChangeText={(v) => setResForm((p) => ({ ...p, total_price: v }))}
            />
          </View>
        </View>
        <SubmitButton
          title="Kaydet"
          color={COLORS.primary}
          loading={busy === 'res'}
          onPress={onSaveReservation}
        />
      </FormCard>

      <FormCard title="Fiyat & Müsaitlik" icon="🏷" borderColor={COLORS.success}>
        <SelectField
          placeholder="Oda Seçin..."
          value={availForm.room_id}
          options={roomOptions}
          onChange={(v) => setAvailForm((p) => ({ ...p, room_id: v }))}
        />
        <View style={styles.row2}>
          <View style={styles.half}>
            <FormLabel>Başlangıç</FormLabel>
            <DateInput
              value={availForm.start_date}
              onChangeValue={(v) => setAvailForm((p) => ({ ...p, start_date: v }))}
            />
          </View>
          <View style={styles.half}>
            <FormLabel>Bitiş</FormLabel>
            <DateInput
              value={availForm.end_date}
              onChangeValue={(v) => setAvailForm((p) => ({ ...p, end_date: v }))}
            />
          </View>
        </View>
        <View style={styles.row2}>
          <View style={styles.half}>
            <FormInput
              placeholder="Fiyat (€)"
              keyboardType="decimal-pad"
              value={availForm.price_eur}
              onChangeText={(v) => setAvailForm((p) => ({ ...p, price_eur: v }))}
            />
          </View>
          <View style={styles.half}>
            <SelectField
              placeholder="Açık"
              value={availForm.status}
              options={statusOptions}
              onChange={(v) => setAvailForm((p) => ({ ...p, status: v }))}
            />
          </View>
        </View>
        <SubmitButton
          title="Takvime İşle"
          color={COLORS.success}
          loading={busy === 'avail'}
          onPress={onSaveAvailability}
        />
      </FormCard>

      <FormCard title="Blokaj ekle" icon="🚫" borderColor={COLORS.textSecondary}>
        <SelectField
          placeholder="Oda Seçin..."
          value={blockForm.room_id}
          options={roomOptions}
          onChange={(v) => setBlockForm((p) => ({ ...p, room_id: v }))}
        />
        <View style={styles.row2}>
          <View style={styles.half}>
            <FormLabel>Kapanış</FormLabel>
            <DateInput
              value={blockForm.check_in}
              onChangeValue={(v) => setBlockForm((p) => ({ ...p, check_in: v }))}
            />
          </View>
          <View style={styles.half}>
            <FormLabel>Açılış</FormLabel>
            <DateInput
              value={blockForm.check_out}
              onChangeValue={(v) => setBlockForm((p) => ({ ...p, check_out: v }))}
            />
          </View>
        </View>
        <FormInput
          placeholder="Açıklama (Örn: Tadilat)"
          value={blockForm.summary}
          onChangeText={(v) => setBlockForm((p) => ({ ...p, summary: v }))}
        />
        <SubmitButton
          title="Odayı Kapat"
          color={COLORS.textSecondary}
          loading={busy === 'block'}
          onPress={onSaveBlock}
        />
      </FormCard>

      <AppPressable
        color={COLORS.danger}
        onPress={() => navigateTo('inventory')}
        style={styles.criticalCard}
      >
        <Text style={[styles.criticalTitle, { color: '#fff' }]}>📦 Kritik Stoklar</Text>
        <Text style={[styles.criticalText, { color: '#fff' }]}>
          {(stats.critical_stock ?? 0) > 0
            ? `${stats.critical_stock} adet kritik stok var!`
            : 'Kritik stok yok'}
        </Text>
      </AppPressable>

      <View style={styles.blocksCard}>
        <Text style={styles.blocksTitle}>📋 Manuel Blokajlar</Text>
        {(cal?.manual_blocks || []).length === 0 ? (
          <Text style={styles.blocksEmpty}>Aktif blokaj bulunmuyor.</Text>
        ) : (
          cal.manual_blocks.map((block) => (
            <View key={String(block.block_id)} style={styles.blockRow}>
              <View>
                <Text style={styles.blockRoom}>{block.room_name}</Text>
                <Text style={styles.blockDates}>
                  {block.check_in?.slice(5).replace('-', '.')} -{' '}
                  {block.check_out?.slice(5).replace('-', '.')}
                </Text>
              </View>
              <DeleteButton
                label="Sil"
                onConfirm={() => onDeleteBlock(block.block_id)}
                style={styles.blockDelete}
              />
            </View>
          ))
        )}
      </View>

    </PageScaffold>

    <BulkUpdateModal
      visible={bulkModalVisible}
      onClose={() => setBulkModalVisible(false)}
      rooms={rooms}
      startDateHint={cal?.start_date}
      loading={busy === 'bulk'}
      onSubmit={onSaveBulk}
    />

    <Modal
      visible={!!summaryTab}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => setSummaryTab(null)}
    >
      <View style={[styles.summaryModal, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 8) }]}>
        {summaryTab ? (
          <CalendarSummaryScreen
            key={summaryTab}
            initialTab={summaryTab}
            onClose={() => setSummaryTab(null)}
            onOpenReservation={(id, snapshot) => {
              setSummaryTab(null);
              openReservation(id, snapshot);
            }}
          />
        ) : null}
      </View>
    </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1 },
  summaryModal: { flex: 1, backgroundColor: COLORS.background },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statBox: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 2,
    alignItems: 'center',
    elevation: 2,
  },
  statLabel: { fontSize: 8, fontWeight: '700', color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  statLabelDark: { color: 'rgba(0,0,0,0.65)' },
  statValue: { fontSize: 18, fontWeight: '800', color: '#fff', marginTop: 2 },
  statValueDark: { color: '#212529', fontSize: 16 },
  statIcon: { fontSize: 16, color: '#fff', marginTop: 2 },
  syncBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  navBtn: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 6,
    padding: 8,
  },
  syncCenter: { flex: 1, alignItems: 'center' },
  todayBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 4,
  },
  todayBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  syncLabel: { fontSize: 11, color: COLORS.textSecondary },
  syncValue: { color: COLORS.textPrimary, fontWeight: '700' },
  syncActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
  },
  syncBtn: {
    minHeight: 28,
    minWidth: 0,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  bulkBtn: {
    minHeight: 28,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  bulkBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  syncBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  selectedSummary: {
    backgroundColor: '#eef4ff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#cfe2ff',
  },
  selectedSummaryText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  row2: { flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
  criticalCard: {
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    alignItems: 'center',
  },
  criticalTitle: { fontWeight: '700', fontSize: 13 },
  criticalText: { fontSize: 14, marginTop: 6, fontWeight: '600' },
  blocksCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  blocksTitle: { fontWeight: '700', fontSize: 14, marginBottom: 10, color: COLORS.textPrimary },
  blocksEmpty: { color: COLORS.textMuted, fontSize: 13 },
  blockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  blockRoom: { fontWeight: '700', fontSize: 13, color: COLORS.textPrimary },
  blockDates: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  blockDelete: {
    minHeight: 36,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  blockDeleteText: { fontSize: 11, fontWeight: '600' },
});
