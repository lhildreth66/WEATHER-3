import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import axios from 'axios';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { API_BASE } from '../lib/apiConfig';

interface GeocodeSuggestion { place_name: string; short_name: string; coordinates: [number, number]; }

interface WindResult {
  location: string;
  wind_speed_mph: number;
  wind_direction: string;
  wind_gust_mph: number | null;
  recommended_orientation: string;
  shelter_score: number;
  tips: string[];
}

export default function WindShelterScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lon: number; name: string } | null>(null);
  const [gettingLocation, setGettingLocation] = useState(true);
  const [rvLength, setRvLength] = useState('30');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WindResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { getCurrentLocation(); }, []);

  const getCurrentLocation = async () => {
    setGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCurrentLocation({ lat: loc.coords.latitude, lon: loc.coords.longitude, name: 'Current Location' });
      } else { setError('Enable location or search for a city'); }
    } catch (err) { setError('Enable location or search for a city'); }
    finally { setGettingLocation(false); }
  };

  const handleSearchQueryChange = async (text: string) => {
    setSearchQuery(text);
    if (text.length >= 2) {
      try {
        const response = await axios.get(`${API_BASE}/api/geocode/autocomplete`, { params: { query: text, limit: 5 } });
        setSuggestions(response.data || []);
        setShowSuggestions(true);
      } catch (err) { setSuggestions([]); }
    } else { setSuggestions([]); setShowSuggestions(false); }
  };

  const selectLocation = (suggestion: GeocodeSuggestion) => {
    setSearchQuery(suggestion.short_name);
    setShowSuggestions(false);
    const [lon, lat] = suggestion.coordinates;
    setCurrentLocation({ lat, lon, name: suggestion.short_name });
  };

  const calculate = async () => {
    if (!currentLocation) { setError('Please select a location first'); return; }
    setLoading(true); setResult(null); setError('');
    try {
      const resp = await axios.post(`${API_BASE}/api/boondocking/wind-shelter`, {
        latitude: currentLocation.lat, longitude: currentLocation.lon, rv_length_ft: parseFloat(rvLength) || 30,
      });
      setResult(resp.data);
    } catch (err: any) { setError(err?.response?.data?.detail || 'Failed to calculate'); }
    finally { setLoading(false); }
  };

  const getScoreColor = (score: number) => score >= 80 ? '#10b981' : score >= 50 ? '#eab308' : '#ef4444';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}><Ionicons name="arrow-back" size={24} color="#fff" /><Text style={styles.backText}>Back</Text></TouchableOpacity>
        <TouchableOpacity onPress={getCurrentLocation} disabled={gettingLocation}>{gettingLocation ? <ActivityIndicator size="small" color="#22d3ee" /> : <Ionicons name="locate" size={24} color="#22d3ee" />}</TouchableOpacity>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>🍃 Wind Shelter</Text>
          <Text style={styles.subtitle}>Get RV orientation recommendations for wind protection</Text>

          <View style={styles.searchSection}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color="#6b7280" style={{ marginRight: 8 }} />
              <TextInput style={styles.searchInput} value={searchQuery} onChangeText={handleSearchQueryChange} placeholder="Search city or address..." placeholderTextColor="#6b7280" />
            </View>
            {showSuggestions && suggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {suggestions.map((s, i) => <TouchableOpacity key={i} style={styles.suggestionItem} onPress={() => selectLocation(s)}><Ionicons name="location" size={16} color="#22d3ee" /><Text style={styles.suggestionText}>{s.place_name}</Text></TouchableOpacity>)}
              </View>
            )}
            {currentLocation && <View style={styles.locationBadge}><Ionicons name="location" size={14} color="#10b981" /><Text style={styles.locationText}>{currentLocation.name}</Text></View>}
          </View>

          <View style={styles.inputGroup}><Text style={styles.label}>RV Length (ft)</Text><TextInput value={rvLength} onChangeText={setRvLength} keyboardType="numeric" style={styles.input} placeholder="30" placeholderTextColor="#6b7280" /></View>

          <TouchableOpacity onPress={calculate} style={styles.button} disabled={loading || !currentLocation}>
            {loading ? <ActivityIndicator color="#1a1a1a" /> : <><Ionicons name="leaf" size={20} color="#1a1a1a" /><Text style={styles.buttonText}>Check Wind Conditions</Text></>}
          </TouchableOpacity>

          {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

          {result && (
            <View style={styles.resultContainer}>
              <View style={styles.resultHeader}><Text style={styles.resultLocation}>{result.location}</Text></View>
              
              <View style={styles.windSection}>
                <View style={styles.windMain}>
                  <Ionicons name="speedometer" size={32} color="#22d3ee" />
                  <Text style={styles.windSpeed}>{result.wind_speed_mph} mph</Text>
                  <Text style={styles.windLabel}>from {result.wind_direction}</Text>
                </View>
                {result.wind_gust_mph && (
                  <View style={styles.gustBadge}><Text style={styles.gustText}>Gusts up to {result.wind_gust_mph} mph</Text></View>
                )}
              </View>

              <View style={styles.scoreSection}>
                <View style={styles.scoreHeader}><Text style={styles.scoreLabel}>Shelter Score</Text><Text style={[styles.scoreValue, { color: getScoreColor(result.shelter_score) }]}>{result.shelter_score}/100</Text></View>
                <View style={styles.scoreBar}><View style={[styles.scoreFill, { width: `${result.shelter_score}%`, backgroundColor: getScoreColor(result.shelter_score) }]} /></View>
              </View>

              <View style={styles.orientationBox}>
                <Ionicons name="compass" size={24} color="#f59e0b" />
                <View style={styles.orientationText}><Text style={styles.orientationLabel}>Recommended Orientation</Text><Text style={styles.orientationValue}>{result.recommended_orientation}</Text></View>
              </View>

              <View style={styles.tipsSection}>
                <Text style={styles.tipsTitle}>Tips</Text>
                {result.tips.map((tip, i) => <View key={i} style={styles.tipRow}><Text style={styles.tipText}>{tip}</Text></View>)}
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
  searchSection: { marginBottom: 16, zIndex: 10 },
  searchInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#27272a', borderRadius: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#3f3f46' },
  searchInput: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 12 },
  suggestionsContainer: { backgroundColor: '#27272a', borderRadius: 10, marginTop: 4, borderWidth: 1, borderColor: '#3f3f46' },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: '#3f3f46' },
  suggestionText: { color: '#e4e4e7', fontSize: 14, flex: 1 },
  locationBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  locationText: { color: '#10b981', fontSize: 13, fontWeight: '500' },
  inputGroup: { marginBottom: 16 },
  label: { color: '#a1a1aa', fontSize: 13, marginBottom: 6 },
  input: { backgroundColor: '#27272a', color: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#3f3f46' },
  button: { backgroundColor: '#22d3ee', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 10 },
  buttonText: { color: '#1a1a1a', fontWeight: '800', fontSize: 16 },
  errorBox: { backgroundColor: '#450a0a', borderRadius: 8, padding: 12, marginTop: 12 },
  errorText: { color: '#fca5a5', fontSize: 14 },
  resultContainer: { marginTop: 20, gap: 16 },
  resultHeader: { alignItems: 'center' },
  resultLocation: { color: '#fff', fontSize: 18, fontWeight: '700' },
  windSection: { alignItems: 'center', backgroundColor: '#0e3a4f', borderRadius: 12, padding: 20 },
  windMain: { alignItems: 'center', gap: 4 },
  windSpeed: { color: '#22d3ee', fontSize: 36, fontWeight: '800' },
  windLabel: { color: '#67e8f9', fontSize: 14 },
  gustBadge: { backgroundColor: '#164e63', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: 10 },
  gustText: { color: '#67e8f9', fontSize: 12 },
  scoreSection: { gap: 8 },
  scoreHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreLabel: { color: '#a1a1aa', fontSize: 14 },
  scoreValue: { fontSize: 24, fontWeight: '800' },
  scoreBar: { height: 10, backgroundColor: '#27272a', borderRadius: 5, overflow: 'hidden' },
  scoreFill: { height: '100%', borderRadius: 5 },
  orientationBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#422006', borderRadius: 12, padding: 16 },
  orientationText: { flex: 1 },
  orientationLabel: { color: '#fbbf24', fontSize: 12 },
  orientationValue: { color: '#fff', fontSize: 15, fontWeight: '600' },
  tipsSection: { backgroundColor: '#1f1f23', borderRadius: 12, padding: 16, gap: 8 },
  tipsTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  tipRow: { paddingVertical: 4 },
  tipText: { color: '#d4d4d8', fontSize: 14, lineHeight: 20 },
});
