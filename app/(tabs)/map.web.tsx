import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

export default function SmokingZonesMapWeb() {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [locationChoiceVisible, setLocationChoiceVisible] = useState(false);
  const [selectingOnMap, setSelectingOnMap] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">{t('map.title')}</Text>
      </View>

      {/* Placeholder area instead of native map on web */}
      <View style={[styles.placeholder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={{ color: colors.textSecondary, textAlign: 'center' }} numberOfLines={2} ellipsizeMode="tail">
          {t('map.loading')}
        </Text>
      </View>

      {/* FABs (layout/i18n preview) */}
      <View style={[styles.fabRow]}>
        <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={() => setLocationChoiceVisible(true)}>
          <Text style={[styles.fabText, { color: '#fff' }]} numberOfLines={1} ellipsizeMode="tail">{t('map.addZone')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: selectingOnMap ? colors.error : colors.surface, borderWidth: 1, borderColor: colors.border }]}
          onPress={() => setSelectingOnMap((v) => !v)}
        >
          <Text style={[styles.fabText, { color: selectingOnMap ? '#fff' : colors.text }]} numberOfLines={1} ellipsizeMode="tail">{selectingOnMap ? t('map.exitSelectMode') : t('map.pickOnMap')}</Text>
        </TouchableOpacity>
        {selectingOnMap && (
          <TouchableOpacity
            style={[styles.fab, { backgroundColor: colors.primary }]}
            onPress={() => {
              setNewTitle('');
              setNewDesc('');
              setAddModalVisible(true);
            }}
          >
            <Text style={[styles.fabText, { color: '#fff' }]} numberOfLines={1} ellipsizeMode="tail">{t('map.confirmCenter')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Add/Edit Modal (UI preview only) */}
      <Modal visible={addModalVisible} transparent animationType="fade" onRequestClose={() => setAddModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>{t('map.zoneTitle')}</Text>
            <TextInput value={newTitle} onChangeText={setNewTitle} style={[styles.input, { borderColor: colors.border, color: colors.text }]} placeholderTextColor={colors.textSecondary} />
            <Text style={[styles.inputLabel, { color: colors.text, marginTop: 12 }]}>{t('map.zoneDescription')}</Text>
            <TextInput value={newDesc} onChangeText={setNewDesc} style={[styles.input, { borderColor: colors.border, color: colors.text }]} placeholderTextColor={colors.textSecondary} />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 }}>
              <TouchableOpacity onPress={() => setAddModalVisible(false)} style={[styles.modalBtn, { borderColor: colors.border }]}>
                <Text style={{ color: colors.text }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setAddModalVisible(false)} style={[styles.modalBtn, { backgroundColor: colors.primary, marginLeft: 8 }]}> 
                <Text style={{ color: '#fff' }}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Location choice modal (UI preview only) */}
      <Modal visible={locationChoiceVisible} transparent animationType="fade" onRequestClose={() => setLocationChoiceVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={2} ellipsizeMode="tail">{t('map.chooseLocation')}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 }}>
              <TouchableOpacity onPress={() => setLocationChoiceVisible(false)} style={[styles.modalBtn, { borderColor: colors.border }]}> 
                <Text style={{ color: colors.text }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setLocationChoiceVisible(false); setSelectingOnMap(true); }} style={[styles.modalBtn, { backgroundColor: colors.surface, borderColor: colors.border, marginLeft: 8 }]}> 
                <Text style={{ color: colors.text }}>{t('map.pickOnMap')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingHorizontal: 24, paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: '700' },
  placeholder: { flex: 1, margin: 16, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  fabRow: { position: 'absolute', bottom: 24, left: 16, right: 16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  fab: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, marginRight: 8, marginBottom: 8, maxWidth: '48%' },
  fabText: { fontSize: 12, fontWeight: '700' },
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: { width: '86%', borderRadius: 12, borderWidth: 1, padding: 16 },
  inputLabel: { fontSize: 14, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 6 },
  modalBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
});
