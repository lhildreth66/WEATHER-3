import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, ScrollView, Alert } from 'react-native';
import axios from 'axios';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { API_BASE } from '../lib/apiConfig';

interface PropaneResult {
  location: string;
  current_temp: number;
  low_temp: number;
  heating_hours_needed: number;
  daily_propane_gallons: number;
  days_until_empty: number;
  recommendation: string;
}

export default function PropaneUsageScreen() {
  const router = useRouter();
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [heaterBtu, setHeaterBtu] = useState('30000');
  const [cookingHours, setCookingHours] = useState('1');
  const [waterHeaterBtu, setWaterHeaterBtu] = useState('10000');
  const [tankSize, setTankSize] = useState('20');

  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);
  const [result, setResult] = useState<PropaneResult | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLatitude(location.coords.latitude.toFixed(4));
        setLongitude(location.coords.longitude.toFixed(4));
      }
    } catch (err) {
      console.log('Could not get current location:', err);
    } finally {
      setLocationLoading(false);
    }
  };

  const refreshLocation = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required.');
        setLocationLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setLatitude(location.coords.latitude.toFixed(4));
      setLongitude(location.coords.longitude.toFixed(4));
    } catch (err) {
      Alert.alert('Error', 'Failed to refresh location');
    } finally {
      setLocationLoading(false);
    }
  };

  const calculate = async () => {
    if (!latitude || !longitude) {
      setError('Location required. Please enable location services.');
      return;
    }

    setLoading(true);
    setResult(null);
    setError('');
    try {
      const resp = await axios.post(`${API_BASE}/api/boondocking/propane-usage`, {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        heater_btu: parseFloat(heaterBtu) || 30000,
        cooking_hours_per_day: parseFloat(cookingHours) || 1,
        water_heater_btu: parseFloat(waterHeaterBtu) || 10000,
        tank_size_gallons: parseFloat(tankSize) || 20,
      });
      setResult(resp.data);
    } catch (err: any) {
      console.error('Propane calculation error:', err);
      setError(err?.response?.data?.detail || err?.message || 'Failed to calculate propane usage');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (days: number) => {
    if (days > 14) return '#10b981';
    if (days > 7) return '#eab308';
    if (days > 3) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={refreshLocation} disabled={locationLoading}>
          {locationLoading ? (
            <ActivityIndicator size="small" color="#f59e0b" />
          ) : (
            <Ionicons name="locate" size={24} color="#f59e0b" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>🔥 Propane Usage</Text>
          <Text style={styles.subtitle}>Calculate fuel consumption based on weather</Text>

          {latitude && longitude && (
            <View style={styles.locationBadge}>
              <Ionicons name="location" size={14} color="#f59e0b" />
              <Text style={styles.locationText}>{latitude}, {longitude}</Text>
            </View>
          )}

          <View style={styles.inputSection}>
            <Text style={styles.sectionTitle}>Your RV Setup</Text>
            
            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Heater BTU</Text>
                <TextInput
                  value={heaterBtu}
                  onChangeText={setHeaterBtu}
                  keyboardType="numeric"
                  style={styles.input}
                  placeholder="30000"
                  placeholderTextColor="#6b7280"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Water Heater BTU</Text>
                <TextInput
                  value={waterHeaterBtu}
                  onChangeText={setWaterHeaterBtu}
                  keyboardType="numeric"
                  style={styles.input}
                  placeholder="10000"
                  placeholderTextColor="#6b7280"
                />
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Cooking Hrs/Day</Text>
                <TextInput
                  value={cookingHours}
                  onChangeText={setCookingHours}
                  keyboardType="numeric"
                  style={styles.input}
                  placeholder="1"
                  placeholderTextColor="#6b7280"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Tank Size (gal)</Text>
                <TextInput
                  value={tankSize}
                  onChangeText={setTankSize}
                  keyboardType="numeric"
                  style={styles.input}
                  placeholder="20"
                  placeholderTextColor="#6b7280"
                />
              </View>
            </View>
          </View>

          <TouchableOpacity onPress={calculate} style={styles.button} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#1a1a1a" />
            ) : (
              <>
                <Ionicons name="flame" size={20} color="#1a1a1a" />
                <Text style={styles.buttonText}>Calculate Usage</Text>
              </>
            )}
          </TouchableOpacity>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={20} color="#fca5a5" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {result && (
            <View style={styles.resultContainer}>
              <View style={styles.resultHeader}>
                <Text style={styles.resultLocation}>{result.location}</Text>
              </View>

              <View style={styles.tempSection}>
                <View style={styles.tempItem}>
                  <Ionicons name="thermometer" size={24} color="#60a5fa" />
                  <Text style={styles.tempValue}>{result.current_temp}°F</Text>
                  <Text style={styles.tempLabel}>Current</Text>
                </View>
                <View style={styles.tempDivider} />
                <View style={styles.tempItem}>
                  <Ionicons name="snow" size={24} color="#93c5fd" />
                  <Text style={styles.tempValue}>{result.low_temp}°F</Text>
                  <Text style={styles.tempLabel}>Expected Low</Text>
                </View>
              </View>

              <View style={styles.usageSection}>
                <Text style={styles.usageSectionTitle}>Daily Usage</Text>
                <View style={styles.usageRow}>
                  <Text style={styles.usageLabel}>Heating Hours Needed</Text>
                  <Text style={styles.usageValue}>{result.heating_hours_needed} hrs</Text>
                </View>
                <View style={styles.usageRow}>
                  <Text style={styles.usageLabel}>Daily Propane</Text>
                  <Text style={styles.usageValue}>{result.daily_propane_gallons} gal</Text>
                </View>
              </View>

              <View style={styles.daysSection}>
                <View style={styles.daysHeader}>
                  <Ionicons name="calendar" size={28} color={getStatusColor(result.days_until_empty)} />
                  <Text style={[styles.daysValue, { color: getStatusColor(result.days_until_empty) }]}>
                    {result.days_until_empty > 99 ? '99+' : result.days_until_empty.toFixed(0)}
                  </Text>
                </View>
                <Text style={styles.daysLabel}>Days Until Refill</Text>
                <View style={styles.daysBar}>
                  <View 
                    style={[
                      styles.daysFill, 
                      { 
                        width: `${Math.min(100, (result.days_until_empty / 14) * 100)}%`,
                        backgroundColor: getStatusColor(result.days_until_empty)
                      }
                    ]} 
                  />
                </View>
              </View>

              <View style={styles.recommendationBox}>
                <Text style={styles.recommendationText}>{result.recommendation}</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  content: { flex: 1 },
  card: { backgroundColor: '#18181b', borderRadius: 16, padding: 20, margin: 16, borderWidth: 1, borderColor: '#27272a' },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  subtitle: { color: '#a1a1aa', fontSize: 14, marginTop: 4, marginBottom: 12 },
  locationBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#27272a', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 16 },
  locationText: { color: '#d4d4d8', fontSize: 12 },
  inputSection: { marginBottom: 16 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  inputRow: { flexDirection: 'row', gap: 12 },
  inputGroup: { flex: 1, marginBottom: 12 },
  label: { color: '#a1a1aa', fontSize: 13, marginBottom: 6 },
  input: { backgroundColor: '#27272a', color: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#3f3f46' },
  button: { backgroundColor: '#f59e0b', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 10 },
  buttonText: { color: '#1a1a1a', fontWeight: '800', fontSize: 16 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#450a0a', borderRadius: 8, padding: 12, marginTop: 12 },
  errorText: { color: '#fca5a5', fontSize: 14, flex: 1 },
  resultContainer: { marginTop: 20, gap: 16 },
  resultHeader: { alignItems: 'center' },
  resultLocation: { color: '#fff', fontSize: 18, fontWeight: '700' },
  tempSection: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#27272a', borderRadius: 12, padding: 16 },
  tempItem: { alignItems: 'center', gap: 4 },
  tempDivider: { width: 1, backgroundColor: '#3f3f46' },
  tempValue: { color: '#fff', fontSize: 24, fontWeight: '800' },
  tempLabel: { color: '#a1a1aa', fontSize: 12 },
  usageSection: { backgroundColor: '#1f1f23', borderRadius: 12, padding: 16 },
  usageSectionTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 12 },
  usageRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  usageLabel: { color: '#a1a1aa', fontSize: 14 },
  usageValue: { color: '#fff', fontSize: 16, fontWeight: '700' },
  daysSection: { alignItems: 'center', gap: 8 },
  daysHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  daysValue: { fontSize: 36, fontWeight: '800' },
  daysLabel: { color: '#a1a1aa', fontSize: 14 },
  daysBar: { width: '100%', height: 10, backgroundColor: '#27272a', borderRadius: 5, overflow: 'hidden' },
  daysFill: { height: '100%', borderRadius: 5 },
  recommendationBox: { backgroundColor: '#1e3a5f', borderRadius: 10, padding: 14 },
  recommendationText: { color: '#93c5fd', fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
