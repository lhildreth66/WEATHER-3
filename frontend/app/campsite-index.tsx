import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, TextInput } from 'react-native';
import axios from 'axios';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { API_BASE } from '../lib/apiConfig';

interface GeocodeSuggestion { place_name: string; short_name: string; coordinates: [number, number]; }

interface CampsiteResult {
  location_name: string;
  overall_score: number;
  overall_rating: string;
  factors: { [key: string]: { score: number; rating: string; detail: string } };
  recommendation: string;
}

export default function CampsiteIndexScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lon: number; name: string } | null>(null);
  const [gettingLocation, setGettingLocation] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CampsiteResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { getCurrentLocation(); }, []);

  const getCurrentLocation = async () => {
    setGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
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
    if (!currentLocation) { setError('Please select a location'); return; }
    setLoading(true); setResult(null); setError('');
    try {
      const resp = await axios.post(`${API_BASE}/api/boondocking/campsite-index`, { latitude: currentLocation.lat, longitude: currentLocation.lon });
      setResult(resp.data);
    } catch (err: any) { setError(err?.response?.data?.detail || 'Failed to calculate'); }
    finally { setLoading(false); }
  };

  const getScoreColor = (score: number) => score >= 80 ? '#10b981' : score >= 60 ? '#22c55e' : score >= 40 ? '#eab308' : '#ef4444';
  const getRatingColor = (rating: string) => {
    switch (rating.toLowerCase()) {
      case 'excellent': return '#10b981';
      case 'good': return '#22c55e';
      case 'fair': return '#eab308';
      case 'poor': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getFactorIcon = (factor: string): string => {
    switch (factor) {
      case 'wind': return 'leaf';
      case 'weather': return 'cloud';
      case 'cell_signal': return 'cellular';
      case 'road_access': return 'car';
      case 'terrain': return 'trail-sign';
      case 'shade': return 'sunny';
      default: return 'analytics';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}><Ionicons name="arrow-back" size={24} color="#fff" /><Text style={styles.backText}>Back</Text></TouchableOpacity>
        <TouchableOpacity onPress={getCurrentLocation} disabled={gettingLocation}>{gettingLocation ? <ActivityIndicator size="small" color="#8b5cf6" /> : <Ionicons name="locate" size={24} color="#8b5cf6" />}</TouchableOpacity>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>📊 Campsite Suitability Index</Text>
          <Text style={styles.subtitle}>Multi-factor analysis of campsite conditions</Text>

          <View style={styles.searchSection}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color="#6b7280" style={{ marginRight: 8 }} />
              <TextInput style={styles.searchInput} value={searchQuery} onChangeText={handleSearchQueryChange} placeholder="Search city or address..." placeholderTextColor="#6b7280" />
            </View>
            {showSuggestions && suggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {suggestions.map((s, i) => <TouchableOpacity key={i} style={styles.suggestionItem} onPress={() => selectLocation(s)}><Ionicons name="location" size={16} color="#8b5cf6" /><Text style={styles.suggestionText}>{s.place_name}</Text></TouchableOpacity>)}
              </View>
            )}
            {currentLocation && <View style={styles.locationBadge}><Ionicons name="location" size={14} color="#10b981" /><Text style={styles.locationText}>{currentLocation.name}</Text></View>}
          </View>

          <TouchableOpacity onPress={calculate} style={styles.button} disabled={loading || !currentLocation}>
            {loading ? <ActivityIndicator color="#1a1a1a" /> : <><Ionicons name="analytics" size={20} color="#1a1a1a" /><Text style={styles.buttonText}>Calculate Index</Text></>}
          </TouchableOpacity>

          {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

          {result && (
            <View style={styles.resultContainer}>
              <View style={styles.resultHeader}><Text style={styles.resultLocation}>{result.location_name}</Text></View>

              <View style={styles.scoreSection}>
                <View style={styles.scoreCircle}>
                  <Text style={[styles.scoreValue, { color: getScoreColor(result.overall_score) }]}>{result.overall_score}</Text>
                  <Text style={styles.scoreMax}>/100</Text>
                </View>
                <View style={[styles.ratingBadge, { backgroundColor: getRatingColor(result.overall_rating) + '30' }]}>
                  <Text style={[styles.ratingText, { color: getRatingColor(result.overall_rating) }]}>{result.overall_rating}</Text>
                </View>
              </View>

              <View style={styles.factorsContainer}>
                <Text style={styles.factorsTitle}>Factors</Text>
                {Object.entries(result.factors).map(([key, factor]) => (
                  <View key={key} style={styles.factorRow}>
                    <View style={styles.factorLeft}>
                      <Ionicons name={getFactorIcon(key) as any} size={20} color={getRatingColor(factor.rating)} />
                      <View><Text style={styles.factorName}>{key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</Text><Text style={styles.factorDetail}>{factor.detail}</Text></View>
                    </View>
                    <View style={styles.factorRight}>
                      <Text style={[styles.factorScore, { color: getScoreColor(factor.score) }]}>{factor.score}</Text>
                      <View style={styles.factorBar}><View style={[styles.factorFill, { width: `${factor.score}%`, backgroundColor: getScoreColor(factor.score) }]} /></View>
                    </View>
                  </View>
                ))}
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
  button: { backgroundColor: '#8b5cf6', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 10 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  errorBox: { backgroundColor: '#450a0a', borderRadius: 8, padding: 12, marginTop: 12 },
  errorText: { color: '#fca5a5', fontSize: 14 },
  resultContainer: { marginTop: 20, gap: 16 },
  resultHeader: { alignItems: 'center' },
  resultLocation: { color: '#fff', fontSize: 18, fontWeight: '700' },
  scoreSection: { alignItems: 'center', gap: 8 },
  scoreCircle: { flexDirection: 'row', alignItems: 'baseline' },
  scoreValue: { fontSize: 48, fontWeight: '800' },
  scoreMax: { fontSize: 20, color: '#6b7280' },
  ratingBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16 },
  ratingText: { fontSize: 16, fontWeight: '700' },
  factorsContainer: { backgroundColor: '#1f1f23', borderRadius: 12, padding: 16, gap: 12 },
  factorsTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  factorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#27272a' },
  factorLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  factorName: { color: '#e4e4e7', fontSize: 14, fontWeight: '600' },
  factorDetail: { color: '#9ca3af', fontSize: 11, maxWidth: 150 },
  factorRight: { alignItems: 'flex-end', gap: 4 },
  factorScore: { fontSize: 16, fontWeight: '700' },
  factorBar: { width: 60, height: 4, backgroundColor: '#3f3f46', borderRadius: 2, overflow: 'hidden' },
  factorFill: { height: '100%', borderRadius: 2 },
  recommendationBox: { backgroundColor: '#1e3a5f', borderRadius: 10, padding: 14 },
  recommendationText: { color: '#93c5fd', fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
