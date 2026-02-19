import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, ScrollView, Switch } from 'react-native';
import axios from 'axios';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE } from '../lib/apiConfig';

export default function WaterBudgetScreen() {
  const router = useRouter();
  const [freshGallons, setFreshGallons] = useState('40');
  const [grayGallons, setGrayGallons] = useState('30');
  const [blackGallons, setBlackGallons] = useState('20');
  const [numPeople, setNumPeople] = useState('2');
  const [showersPerWeek, setShowersPerWeek] = useState('7');
  const [hotDays, setHotDays] = useState(false);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const calculate = async () => {
    setLoading(true);
    setResult(null);
    setError('');
    try {
      const resp = await axios.post(`${API_BASE}/api/water-budget`, {
        fresh_gal: parseInt(freshGallons, 10) || 40,
        gray_gal: parseInt(grayGallons, 10) || 30,
        black_gal: parseInt(blackGallons, 10) || 20,
        people: parseInt(numPeople, 10) || 2,
        showers_per_week: parseFloat(showersPerWeek) || 7,
        hot_days: hotDays,
      });
      setResult(resp.data);
    } catch (err: any) {
      console.error('Water budget calculation error:', err);
      setError(err?.response?.data?.detail || err?.message || 'Failed to calculate water budget');
    } finally {
      setLoading(false);
    }
  };

  const getTankColor = (days: number) => {
    if (days >= 7) return '#22c55e';
    if (days >= 4) return '#eab308';
    if (days >= 2) return '#f97316';
    return '#ef4444';
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton} data-testid="back-button">
        <Ionicons name="arrow-back" size={24} color="#fff" />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Ionicons name="water" size={28} color="#3b82f6" />
            <Text style={styles.title}>Water Budget Planner</Text>
          </View>
          <Text style={styles.subtitle}>Calculate how long your tanks will last while boondocking</Text>

          {/* Tank Capacities Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tank Capacities</Text>
            
            <View style={styles.tankRow}>
              <View style={styles.tankIcon}>
                <Ionicons name="water" size={20} color="#3b82f6" />
              </View>
              <View style={styles.tankInfo}>
                <Text style={styles.label}>Fresh Water Tank</Text>
                <Text style={styles.labelHint}>Drinking, cooking, showers</Text>
              </View>
              <View style={styles.inputSmall}>
                <TextInput
                  value={freshGallons}
                  onChangeText={setFreshGallons}
                  keyboardType="numeric"
                  style={styles.inputField}
                  placeholder="40"
                  placeholderTextColor="#6b7280"
                  data-testid="fresh-water-input"
                />
                <Text style={styles.inputUnit}>gal</Text>
              </View>
            </View>

            <View style={styles.tankRow}>
              <View style={[styles.tankIcon, { backgroundColor: '#374151' }]}>
                <Ionicons name="water-outline" size={20} color="#9ca3af" />
              </View>
              <View style={styles.tankInfo}>
                <Text style={styles.label}>Gray Water Tank</Text>
                <Text style={styles.labelHint}>Sink & shower drain</Text>
              </View>
              <View style={styles.inputSmall}>
                <TextInput
                  value={grayGallons}
                  onChangeText={setGrayGallons}
                  keyboardType="numeric"
                  style={styles.inputField}
                  placeholder="30"
                  placeholderTextColor="#6b7280"
                  data-testid="gray-water-input"
                />
                <Text style={styles.inputUnit}>gal</Text>
              </View>
            </View>

            <View style={styles.tankRow}>
              <View style={[styles.tankIcon, { backgroundColor: '#1c1917' }]}>
                <Ionicons name="close-circle" size={20} color="#78716c" />
              </View>
              <View style={styles.tankInfo}>
                <Text style={styles.label}>Black Water Tank</Text>
                <Text style={styles.labelHint}>Toilet waste</Text>
              </View>
              <View style={styles.inputSmall}>
                <TextInput
                  value={blackGallons}
                  onChangeText={setBlackGallons}
                  keyboardType="numeric"
                  style={styles.inputField}
                  placeholder="20"
                  placeholderTextColor="#6b7280"
                  data-testid="black-water-input"
                />
                <Text style={styles.inputUnit}>gal</Text>
              </View>
            </View>
          </View>

          {/* Usage Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Usage Pattern</Text>
            
            <View style={styles.inputRow}>
              <Ionicons name="people" size={20} color="#a1a1aa" />
              <Text style={styles.label}>Number of People</Text>
              <View style={styles.inputSmall}>
                <TextInput
                  value={numPeople}
                  onChangeText={setNumPeople}
                  keyboardType="numeric"
                  style={styles.inputField}
                  placeholder="2"
                  placeholderTextColor="#6b7280"
                  data-testid="people-input"
                />
              </View>
            </View>

            <View style={styles.inputRow}>
              <Ionicons name="rainy" size={20} color="#a1a1aa" />
              <Text style={styles.label}>Showers Per Week (total)</Text>
              <View style={styles.inputSmall}>
                <TextInput
                  value={showersPerWeek}
                  onChangeText={setShowersPerWeek}
                  keyboardType="numeric"
                  style={styles.inputField}
                  placeholder="7"
                  placeholderTextColor="#6b7280"
                  data-testid="showers-input"
                />
              </View>
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleLeft}>
                <Ionicons name="sunny" size={20} color="#f59e0b" />
                <View>
                  <Text style={styles.label}>Hot Weather Mode</Text>
                  <Text style={styles.labelHint}>+30% water usage</Text>
                </View>
              </View>
              <Switch
                value={hotDays}
                onValueChange={setHotDays}
                trackColor={{ false: '#3f3f46', true: '#f59e0b80' }}
                thumbColor={hotDays ? '#f59e0b' : '#71717a'}
              />
            </View>
          </View>

          <TouchableOpacity onPress={calculate} style={styles.button} disabled={loading} data-testid="calculate-button">
            {loading ? <ActivityIndicator color="#1a1a1a" /> : <Text style={styles.buttonText}>Calculate Water Budget</Text>}
          </TouchableOpacity>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color="#fecaca" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {result && (
            <View style={styles.resultBox}>
              {/* Main Result */}
              <View style={styles.mainResult}>
                <Text style={styles.resultDays}>{result.days_remaining}</Text>
                <Text style={styles.resultLabel}>Days Until Empty</Text>
                <Text style={styles.limitingFactor}>Limited by: {result.limiting_factor}</Text>
              </View>

              {/* Tank Breakdown */}
              <View style={styles.tankBreakdown}>
                <Text style={styles.breakdownTitle}>Tank Breakdown</Text>
                
                <View style={styles.tankResult}>
                  <View style={styles.tankResultLeft}>
                    <Ionicons name="water" size={18} color="#3b82f6" />
                    <Text style={styles.tankName}>Fresh</Text>
                  </View>
                  <View style={styles.tankResultRight}>
                    <Text style={[styles.tankDays, { color: getTankColor(result.fresh_days) }]}>
                      {result.fresh_days} days
                    </Text>
                    <Text style={styles.tankUsage}>{result.daily_fresh_gal} gal/day</Text>
                  </View>
                </View>

                <View style={styles.tankResult}>
                  <View style={styles.tankResultLeft}>
                    <Ionicons name="water-outline" size={18} color="#9ca3af" />
                    <Text style={styles.tankName}>Gray</Text>
                  </View>
                  <View style={styles.tankResultRight}>
                    <Text style={[styles.tankDays, { color: getTankColor(result.gray_days) }]}>
                      {result.gray_days} days
                    </Text>
                    <Text style={styles.tankUsage}>{result.daily_gray_gal} gal/day</Text>
                  </View>
                </View>

                <View style={styles.tankResult}>
                  <View style={styles.tankResultLeft}>
                    <Ionicons name="close-circle" size={18} color="#78716c" />
                    <Text style={styles.tankName}>Black</Text>
                  </View>
                  <View style={styles.tankResultRight}>
                    <Text style={[styles.tankDays, { color: getTankColor(result.black_days) }]}>
                      {result.black_days} days
                    </Text>
                    <Text style={styles.tankUsage}>{result.daily_black_gal} gal/day</Text>
                  </View>
                </View>
              </View>

              {result.advisory && (
                <View style={[
                  styles.advisoryBox,
                  result.days_remaining < 2 ? styles.advisoryWarning :
                  result.days_remaining < 4 ? styles.advisoryCaution : styles.advisoryGood
                ]}>
                  <Ionicons 
                    name={result.days_remaining < 4 ? "warning" : "checkmark-circle"} 
                    size={18} 
                    color={result.days_remaining < 2 ? "#fecaca" : result.days_remaining < 4 ? "#fde68a" : "#86efac"} 
                  />
                  <Text style={[
                    styles.advisoryText,
                    result.days_remaining < 2 ? styles.advisoryTextWarning :
                    result.days_remaining < 4 ? styles.advisoryTextCaution : styles.advisoryTextGood
                  ]}>{result.advisory}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Tips Card */}
        <View style={styles.tipsCard}>
          <View style={styles.tipsHeader}>
            <Ionicons name="bulb" size={20} color="#eab308" />
            <Text style={styles.tipsTitle}>Water Conservation Tips</Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark" size={14} color="#22c55e" />
            <Text style={styles.tipText}>Navy showers: Wet, turn off, lather, rinse</Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark" size={14} color="#22c55e" />
            <Text style={styles.tipText}>Use paper plates to reduce dish washing</Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark" size={14} color="#22c55e" />
            <Text style={styles.tipText}>Catch shower warm-up water for dishes</Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark" size={14} color="#22c55e" />
            <Text style={styles.tipText}>Use public restrooms when available</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  backButton: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 8 },
  backText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  content: { flex: 1 },
  card: { backgroundColor: '#18181b', borderRadius: 12, padding: 16, margin: 16, marginTop: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  subtitle: { color: '#9ca3af', fontSize: 13, marginBottom: 20 },
  section: { marginBottom: 20 },
  sectionTitle: { color: '#e4e4e7', fontSize: 14, fontWeight: '700', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  tankRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  tankIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#1e3a5f', justifyContent: 'center', alignItems: 'center' },
  tankInfo: { flex: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  label: { color: '#e4e4e7', fontWeight: '600', fontSize: 14 },
  labelHint: { color: '#6b7280', fontSize: 11 },
  inputSmall: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#27272a', borderRadius: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#3f3f46' },
  inputField: { color: '#fff', fontSize: 16, fontWeight: '600', paddingVertical: 8, width: 50, textAlign: 'center' },
  inputUnit: { color: '#6b7280', fontSize: 12, marginLeft: 4 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  button: { backgroundColor: '#3b82f6', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#7f1d1d', borderRadius: 8, padding: 12, marginTop: 12 },
  errorText: { color: '#fecaca', fontSize: 13, flex: 1 },
  resultBox: { backgroundColor: '#1f1f23', borderRadius: 10, padding: 16, marginTop: 16 },
  mainResult: { alignItems: 'center', paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#27272a', marginBottom: 16 },
  resultDays: { color: '#3b82f6', fontSize: 56, fontWeight: '800' },
  resultLabel: { color: '#d4d4d8', fontSize: 16, fontWeight: '600' },
  limitingFactor: { color: '#9ca3af', fontSize: 13, marginTop: 4 },
  tankBreakdown: { marginBottom: 16 },
  breakdownTitle: { color: '#a1a1aa', fontSize: 12, fontWeight: '600', marginBottom: 12, textTransform: 'uppercase' },
  tankResult: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#27272a' },
  tankResultLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tankName: { color: '#e4e4e7', fontSize: 14, fontWeight: '500' },
  tankResultRight: { alignItems: 'flex-end' },
  tankDays: { fontSize: 16, fontWeight: '700' },
  tankUsage: { color: '#6b7280', fontSize: 11 },
  advisoryBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 8 },
  advisoryWarning: { backgroundColor: '#7f1d1d' },
  advisoryCaution: { backgroundColor: '#78350f' },
  advisoryGood: { backgroundColor: '#14532d' },
  advisoryText: { flex: 1, fontSize: 13, lineHeight: 18 },
  advisoryTextWarning: { color: '#fecaca' },
  advisoryTextCaution: { color: '#fde68a' },
  advisoryTextGood: { color: '#86efac' },
  tipsCard: { backgroundColor: '#1c1917', borderRadius: 12, padding: 16, marginHorizontal: 16, borderWidth: 1, borderColor: '#eab30830' },
  tipsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  tipsTitle: { color: '#fbbf24', fontSize: 14, fontWeight: '700' },
  tipItem: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  tipText: { color: '#d4d4d8', fontSize: 13 },
});
