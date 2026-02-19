import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import axios from 'axios';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { API_BASE } from '../lib/apiConfig';

interface GeocodeSuggestion {
  place_name: string;
  short_name: string;
  coordinates: [number, number];
}

interface SolarResult {
  location: string;
  forecast_date: string;
  sunrise: string;
  sunset: string;
  daylight_hours: number;
  cloud_cover_percent: number;
  expected_sun_hours: number;
  estimated_production_wh: number;
  consumption_wh: number;
  net_energy_wh: number;
  battery_charge_percent: number;
  recommendation: string;
}

export default function SolarForecastScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lon: number; name: string } | null>(null);
  const [gettingLocation, setGettingLocation] = useState(true);
  
  const [panelWatts, setPanelWatts] = useState('400');
  const [batteryCapacity, setBatteryCapacity] = useState('200');
  const [dailyConsumption, setDailyConsumption] = useState('2000');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SolarResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { getCurrentLocation(); }, []);

  const getCurrentLocation = async () => {
    setGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCurrentLocation({ lat: loc.coords.latitude, lon: loc.coords.longitude, name: 'Current Location' });
      } else {
        setError('Enable location or search for a city');
      }
    } catch (err) {
      setError('Enable location or search for a city');
    } finally {
      setGettingLocation(false);
    }
  };

  const handleSearchQueryChange = async (text: string) => {
    setSearchQuery(text);
    if (text.length >= 2) {
      try {
        const response = await axios.get(`${API_BASE}/api/geocode/autocomplete`, { params: { query: text, limit: 5 } });
        setSuggestions(response.data || []);
        setShowSuggestions(true);
      } catch (err) { setSuggestions([]); }
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectLocation = (suggestion: GeocodeSuggestion) => {
    setSearchQuery(suggestion.short_name);
    setShowSuggestions(false);
    const [lon, lat] = suggestion.coordinates;
    setCurrentLocation({ lat, lon, name: suggestion.short_name });
  };

  const runForecast = async () => {
    if (!currentLocation) {
      setError('Please select a location first');
      return;
    }
    setLoading(true);
    setResult(null);
    setError('');
    try {
      const resp = await axios.post(`${API_BASE}/api/boondocking/solar-forecast`, {
        latitude: currentLocation.lat,
        longitude: currentLocation.lon,
        panel_watts: parseFloat(panelWatts) || 400,
        battery_capacity_ah: parseFloat(batteryCapacity) || 200,
        daily_consumption_wh: parseFloat(dailyConsumption) || 2000,
      });
      setResult(resp.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to calculate');
    } finally {
      setLoading(false);
    }
  };

  const getEnergyColor = (net: number) => net > 500 ? '#10b981' : net > 0 ? '#eab308' : '#ef4444';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}><Ionicons name="arrow-back" size={24} color="#fff" /><Text style={styles.backText}>Back</Text></TouchableOpacity>
        <TouchableOpacity onPress={getCurrentLocation} disabled={gettingLocation}>{gettingLocation ? <ActivityIndicator size="small" color="#eab308" /> : <Ionicons name="locate" size={24} color="#eab308" />}</TouchableOpacity>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>☀️ Solar Forecast</Text>
          <Text style={styles.subtitle}>Estimate solar power output at your campsite</Text>

          {/* Location Search */}
          <View style={styles.searchSection}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color="#6b7280" style={{ marginRight: 8 }} />
              <TextInput style={styles.searchInput} value={searchQuery} onChangeText={handleSearchQueryChange} placeholder="Search city or address..." placeholderTextColor="#6b7280" />
            </View>
            {showSuggestions && suggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {suggestions.map((s, i) => <TouchableOpacity key={i} style={styles.suggestionItem} onPress={() => selectLocation(s)}><Ionicons name="location" size={16} color="#eab308" /><Text style={styles.suggestionText}>{s.place_name}</Text></TouchableOpacity>)}
              </View>
            )}
            {currentLocation && <View style={styles.locationBadge}><Ionicons name="location" size={14} color="#10b981" /><Text style={styles.locationText}>{currentLocation.name}</Text></View>}
          </View>

          <View style={styles.inputSection}>
            <Text style={styles.sectionTitle}>Your Solar Setup</Text>
            <View style={styles.inputRow}>
              <View style={styles.inputGroup}><Text style={styles.label}>Panel Watts</Text><TextInput value={panelWatts} onChangeText={setPanelWatts} keyboardType="numeric" style={styles.input} placeholder="400" placeholderTextColor="#6b7280" /></View>
              <View style={styles.inputGroup}><Text style={styles.label}>Battery (Ah)</Text><TextInput value={batteryCapacity} onChangeText={setBatteryCapacity} keyboardType="numeric" style={styles.input} placeholder="200" placeholderTextColor="#6b7280" /></View>
            </View>
            <View style={styles.inputGroup}><Text style={styles.label}>Daily Consumption (Wh)</Text><TextInput value={dailyConsumption} onChangeText={setDailyConsumption} keyboardType="numeric" style={styles.input} placeholder="2000" placeholderTextColor="#6b7280" /></View>
          </View>

          <TouchableOpacity onPress={runForecast} style={styles.button} disabled={loading || !currentLocation}>
            {loading ? <ActivityIndicator color="#1a1a1a" /> : <><Ionicons name="sunny" size={20} color="#1a1a1a" /><Text style={styles.buttonText}>Calculate Forecast</Text></>}
          </TouchableOpacity>

          {error && <View style={styles.errorBox}><Ionicons name="alert-circle" size={20} color="#fca5a5" /><Text style={styles.errorText}>{error}</Text></View>}

          {result && (
            <View style={styles.resultContainer}>
              <View style={styles.resultHeader}><Text style={styles.resultLocation}>{result.location}</Text><Text style={styles.resultDate}>{result.forecast_date}</Text></View>

              <View style={styles.sunTimes}>
                <View style={styles.sunTimeItem}><Ionicons name="sunny" size={20} color="#fbbf24" /><Text style={styles.sunTimeLabel}>Sunrise</Text><Text style={styles.sunTimeValue}>{result.sunrise}</Text></View>
                <View style={styles.sunTimeItem}><Ionicons name="moon" size={20} color="#8b5cf6" /><Text style={styles.sunTimeLabel}>Sunset</Text><Text style={styles.sunTimeValue}>{result.sunset}</Text></View>
              </View>

              <View style={styles.statsGrid}>
                <View style={styles.statCard}><Text style={styles.statValue}>{result.expected_sun_hours}h</Text><Text style={styles.statLabel}>Sun Hours</Text></View>
                <View style={styles.statCard}><Text style={styles.statValue}>{result.cloud_cover_percent}%</Text><Text style={styles.statLabel}>Cloud Cover</Text></View>
              </View>

              <View style={styles.energySection}>
                <Text style={styles.energySectionTitle}>Energy Balance</Text>
                <View style={styles.energyRow}><Text style={styles.energyLabel}>Production</Text><Text style={[styles.energyValue, { color: '#10b981' }]}>+{result.estimated_production_wh} Wh</Text></View>
                <View style={styles.energyRow}><Text style={styles.energyLabel}>Consumption</Text><Text style={[styles.energyValue, { color: '#ef4444' }]}>-{result.consumption_wh} Wh</Text></View>
                <View style={[styles.energyRow, styles.energyTotal]}><Text style={styles.energyLabel}>Net Energy</Text><Text style={[styles.energyValue, { color: getEnergyColor(result.net_energy_wh) }]}>{result.net_energy_wh > 0 ? '+' : ''}{result.net_energy_wh} Wh</Text></View>
              </View>

              <View style={styles.batterySection}>
                <View style={styles.batteryHeader}><Ionicons name="battery-charging" size={24} color="#10b981" /><Text style={styles.batteryPercent}>{result.battery_charge_percent}%</Text></View>
                <View style={styles.batteryBar}><View style={[styles.batteryFill, { width: `${Math.min(100, result.battery_charge_percent)}%` }]} /></View>
                <Text style={styles.batteryLabel}>Estimated Battery Level</Text>
              </View>

              <View style={styles.recommendationBox}><Text style={styles.recommendationText}>{result.recommendation}</Text></View>
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
  searchSection: { marginBottom: 16, zIndex: 10 },
  searchInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#27272a', borderRadius: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#3f3f46' },
  searchInput: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 12 },
  suggestionsContainer: { backgroundColor: '#27272a', borderRadius: 10, marginTop: 4, borderWidth: 1, borderColor: '#3f3f46' },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: '#3f3f46' },
  suggestionText: { color: '#e4e4e7', fontSize: 14, flex: 1 },
  locationBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  locationText: { color: '#10b981', fontSize: 13, fontWeight: '500' },
  inputSection: { marginBottom: 16 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  inputRow: { flexDirection: 'row', gap: 12 },
  inputGroup: { flex: 1, marginBottom: 12 },
  label: { color: '#a1a1aa', fontSize: 13, marginBottom: 6 },
  input: { backgroundColor: '#27272a', color: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#3f3f46' },
  button: { backgroundColor: '#eab308', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 10 },
  buttonText: { color: '#1a1a1a', fontWeight: '800', fontSize: 16 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#450a0a', borderRadius: 8, padding: 12, marginTop: 12 },
  errorText: { color: '#fca5a5', fontSize: 14, flex: 1 },
  resultContainer: { marginTop: 20, gap: 16 },
  resultHeader: { alignItems: 'center' },
  resultLocation: { color: '#fff', fontSize: 18, fontWeight: '700' },
  resultDate: { color: '#a1a1aa', fontSize: 14 },
  sunTimes: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#27272a', borderRadius: 12, padding: 16 },
  sunTimeItem: { alignItems: 'center', gap: 4 },
  sunTimeLabel: { color: '#a1a1aa', fontSize: 12 },
  sunTimeValue: { color: '#fff', fontSize: 16, fontWeight: '600' },
  statsGrid: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, backgroundColor: '#27272a', borderRadius: 10, padding: 16, alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 24, fontWeight: '800' },
  statLabel: { color: '#a1a1aa', fontSize: 12, marginTop: 4 },
  energySection: { backgroundColor: '#1f1f23', borderRadius: 12, padding: 16 },
  energySectionTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 12 },
  energyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  energyTotal: { borderTopWidth: 1, borderTopColor: '#3f3f46', marginTop: 8, paddingTop: 12 },
  energyLabel: { color: '#a1a1aa', fontSize: 14 },
  energyValue: { fontSize: 16, fontWeight: '700' },
  batterySection: { alignItems: 'center', gap: 8 },
  batteryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  batteryPercent: { color: '#10b981', fontSize: 28, fontWeight: '800' },
  batteryBar: { width: '100%', height: 12, backgroundColor: '#27272a', borderRadius: 6, overflow: 'hidden' },
  batteryFill: { height: '100%', backgroundColor: '#10b981', borderRadius: 6 },
  batteryLabel: { color: '#a1a1aa', fontSize: 12 },
  recommendationBox: { backgroundColor: '#1e3a5f', borderRadius: 10, padding: 14 },
  recommendationText: { color: '#93c5fd', fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
