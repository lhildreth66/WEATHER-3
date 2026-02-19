import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { API_BASE } from '../lib/apiConfig';

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  is_default: boolean;
}

export default function CampPrepChecklistScreen() {
  const router = useRouter();
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newItemText, setNewItemText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadChecklist();
  }, []);

  const loadChecklist = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/boondocking/checklist`);
      setChecklist(response.data.items || []);
    } catch (error) {
      console.error('Failed to load checklist:', error);
      // Use default checklist if API fails
      setChecklist([
        { id: '1', text: 'Fresh water tank filled', checked: false, is_default: true },
        { id: '2', text: 'Propane tanks full', checked: false, is_default: true },
        { id: '3', text: 'Batteries charged', checked: false, is_default: true },
        { id: '4', text: 'Grey/black tanks empty', checked: false, is_default: true },
        { id: '5', text: 'Tire pressure checked', checked: false, is_default: true },
        { id: '6', text: 'Hitch and connections secure', checked: false, is_default: true },
        { id: '7', text: 'Food and supplies stocked', checked: false, is_default: true },
        { id: '8', text: 'First aid kit packed', checked: false, is_default: true },
        { id: '9', text: 'Maps and GPS updated', checked: false, is_default: true },
        { id: '10', text: 'Emergency contact list ready', checked: false, is_default: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const saveChecklist = async (items: ChecklistItem[]) => {
    setSaving(true);
    try {
      await axios.post(`${API_BASE}/api/boondocking/checklist`, items);
    } catch (error) {
      console.error('Failed to save checklist:', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleItem = (id: string) => {
    const updated = checklist.map(item => 
      item.id === id ? { ...item, checked: !item.checked } : item
    );
    setChecklist(updated);
    saveChecklist(updated);
  };

  const addItem = () => {
    if (!newItemText.trim()) return;
    const newItem: ChecklistItem = {
      id: Date.now().toString(),
      text: newItemText.trim(),
      checked: false,
      is_default: false
    };
    const updated = [...checklist, newItem];
    setChecklist(updated);
    setNewItemText('');
    saveChecklist(updated);
  };

  const deleteItem = (id: string) => {
    const updated = checklist.filter(item => item.id !== id);
    setChecklist(updated);
    saveChecklist(updated);
  };

  const resetChecklist = () => {
    const reset = checklist.map(item => ({ ...item, checked: false }));
    setChecklist(reset);
    saveChecklist(reset);
  };

  const progress = checklist.length > 0 
    ? (checklist.filter(i => i.checked).length / checklist.length * 100) 
    : 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#eab308" />
          <Text style={styles.loadingText}>Loading checklist...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        {saving && (
          <View style={styles.savingIndicator}>
            <ActivityIndicator size="small" color="#eab308" />
            <Text style={styles.savingText}>Saving...</Text>
          </View>
        )}
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <View>
              <Text style={styles.title}>🏕️ Camp Prep Checklist</Text>
              <Text style={styles.subtitle}>Stay organized for your next adventure</Text>
            </View>
            <TouchableOpacity onPress={resetChecklist} style={styles.resetButton}>
              <Ionicons name="refresh" size={20} color="#eab308" />
            </TouchableOpacity>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {checklist.filter(i => i.checked).length}/{checklist.length} Complete ({Math.round(progress)}%)
            </Text>
          </View>

          <View style={styles.addRow}>
            <TextInput
              value={newItemText}
              onChangeText={setNewItemText}
              placeholder="Add custom item..."
              placeholderTextColor="#6b7280"
              style={styles.addInput}
              onSubmitEditing={addItem}
              returnKeyType="done"
            />
            <TouchableOpacity onPress={addItem} style={styles.addButton}>
              <Ionicons name="add" size={24} color="#1a1a1a" />
            </TouchableOpacity>
          </View>

          <View style={styles.listContainer}>
            {checklist.map((item, index) => (
              <View 
                key={item.id} 
                style={[
                  styles.checklistItem,
                  index === checklist.length - 1 && styles.lastItem
                ]}
              >
                <TouchableOpacity 
                  onPress={() => toggleItem(item.id)} 
                  style={styles.checkRow}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.checkbox,
                    item.checked && styles.checkboxChecked
                  ]}>
                    {item.checked && (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    )}
                  </View>
                  <Text style={[
                    styles.itemText, 
                    item.checked && styles.itemTextChecked
                  ]}>
                    {item.text}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => deleteItem(item.id)}
                  style={styles.deleteButton}
                >
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {progress === 100 && (
            <View style={styles.completeMessage}>
              <Ionicons name="checkmark-circle" size={24} color="#10b981" />
              <Text style={styles.completeText}>All set! Ready to hit the road! 🚐</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0a0a0a' 
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#a1a1aa',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8 
  },
  backText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: '600' 
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  savingText: {
    color: '#eab308',
    fontSize: 12,
  },
  content: { 
    flex: 1 
  },
  card: { 
    backgroundColor: '#18181b', 
    borderRadius: 16, 
    padding: 20, 
    margin: 16,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: { 
    color: '#fff', 
    fontSize: 22, 
    fontWeight: '800' 
  },
  subtitle: { 
    color: '#a1a1aa', 
    fontSize: 14,
    marginTop: 4,
  },
  resetButton: {
    padding: 8,
    backgroundColor: '#27272a',
    borderRadius: 8,
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressBar: { 
    height: 10, 
    backgroundColor: '#27272a', 
    borderRadius: 5, 
    overflow: 'hidden' 
  },
  progressFill: { 
    height: '100%', 
    backgroundColor: '#10b981',
    borderRadius: 5,
  },
  progressText: { 
    color: '#a1a1aa', 
    fontSize: 13, 
    textAlign: 'center',
    marginTop: 8,
  },
  addRow: { 
    flexDirection: 'row', 
    gap: 10,
    marginBottom: 16,
  },
  addInput: { 
    flex: 1, 
    backgroundColor: '#27272a', 
    color: '#fff', 
    borderRadius: 10, 
    paddingHorizontal: 14, 
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  addButton: { 
    backgroundColor: '#eab308', 
    width: 48, 
    height: 48, 
    borderRadius: 10, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  listContainer: {
    borderTopWidth: 1,
    borderTopColor: '#27272a',
    paddingTop: 8,
  },
  checklistItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  checkRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    flex: 1 
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#4b5563',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  itemText: { 
    color: '#e5e7eb', 
    fontSize: 15, 
    flex: 1 
  },
  itemTextChecked: { 
    textDecorationLine: 'line-through', 
    color: '#6b7280' 
  },
  deleteButton: {
    padding: 8,
  },
  completeMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#052e16',
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
  },
  completeText: {
    color: '#10b981',
    fontSize: 15,
    fontWeight: '600',
  },
});
