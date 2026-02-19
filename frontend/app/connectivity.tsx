import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, TextInput } from 'react-native';
import axios from 'axios';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { API_BASE } from '../lib/apiConfig';

interface GeocodeSuggestion { place_name: string; short_name: string; coordinates: [number, number]; }

interface CarrierInfo {
  name: string;
  signal_bars: number;
  signal_strength: string;
  lte_available: boolean;
  '5g_available'?: boolean;
  satellite?: boolean;
  note?: string;
}

interface ConnectivityResult {
  location_name: string;
  carriers: CarrierInfo[];
  overall_rating: string;
  recommendation: string;
}

export default function ConnectivityScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lon: number; name: string } | null>(null);
  const [gettingLocation, setGettingLocation] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ConnectivityResult | null>(null);
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

  const checkConnectivity = async () => {
    if (!currentLocation) { setError('Please select a location'); return; }
    setLoading(true); setResult(null); setError('');
    try {
      const resp = await axios.get(`${API_BASE}/api/boondocking/connectivity`, { params: { latitude: currentLocation.lat, longitude: currentLocation.lon } });
      setResult(resp.data);
    } catch (err: any) { setError(err?.response?.data?.detail || 'Failed to check connectivity'); }
    finally { setLoading(false); }
  };

  const getSignalBars = (bars: number) => (
    <View style={styles.signalBars}>
      {[1, 2, 3, 4, 5].map((i) => <View key={i} style={[styles.signalBar, { height: 6 + i * 4 }, i <= bars ? styles.signalBarFilled : styles.signalBarEmpty]} />)}
    </View>
  );

  const getSignalColor = (strength: string) => {
    switch (strength.toLowerCase()) {
      case 'excellent': return '#10b981';
      case 'good': return '#22c55e';
      case 'fair': return '#eab308';
      case 'weak': return '#f59e0b';
      default: return '#ef4444';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}><Ionicons name="arrow-back" size={24} color="#fff" /><Text style={styles.backText}>Back</Text></TouchableOpacity>
        <TouchableOpacity onPress={getCurrentLocation} disabled={gettingLocation}>{gettingLocation ? <ActivityIndicator size="small" color="#60a5fa" /> : <Ionicons name="locate" size={24} color="#60a5fa" />}</TouchableOpacity>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>📡 Connectivity Check</Text>
          <Text style={styles.subtitle}>Check cell signal estimates for your location</Text>

          <View style={styles.searchSection}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color="#6b7280" style={{ marginRight: 8 }} />
              <TextInput style={styles.searchInput} value={searchQuery} onChangeText={handleSearchQueryChange} placeholder="Search city or address..." placeholderTextColor="#6b7280" />
            </View>
            {showSuggestions && suggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                {suggestions.map((s, i) => <TouchableOpacity key={i} style={styles.suggestionItem} onPress={() => selectLocation(s)}><Ionicons name="location" size={16} color="#60a5fa" /><Text style={styles.suggestionText}>{s.place_name}</Text></TouchableOpacity>)}
              </View>
            )}
            {currentLocation && <View style={styles.locationBadge}><Ionicons name="location" size={14} color="#10b981" /><Text style={styles.locationText}>{currentLocation.name}</Text></View>}
          </View>

          <TouchableOpacity onPress={checkConnectivity} style={styles.button} disabled={loading || !currentLocation}>
            {loading ? <ActivityIndicator color="#1a1a1a" /> : <><Ionicons name="wifi" size={20} color="#1a1a1a" /><Text style={styles.buttonText}>Check Signal</Text></>}
          </TouchableOpacity>

          {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}

          {result && (
            <View style={styles.resultContainer}>
              <View style={styles.resultHeader}>
                <Text style={styles.resultLocation}>{result.location_name}</Text>
                <View style={[styles.overallBadge, { backgroundColor: getSignalColor(result.overall_rating) + '30' }]}>
                  <Text style={[styles.overallText, { color: getSignalColor(result.overall_rating) }]}>{result.overall_rating}</Text>
                </View>
              </View>

              <View style={styles.carriersContainer}>
                {result.carriers.map((carrier, index) => (
                  <View key={index} style={styles.carrierCard}>
                    <View style={styles.carrierHeader}>
                      <Ionicons name={carrier.satellite ? 'planet' : 'cellular'} size={24} color={getSignalColor(carrier.signal_strength)} />
                      <Text style={styles.carrierName}>{carrier.name}</Text>
                      {getSignalBars(carrier.signal_bars)}
                    </View>
                    <View style={styles.carrierDetails}>
                      <View style={[styles.strengthBadge, { backgroundColor: getSignalColor(carrier.signal_strength) + '30' }]}>
                        <Text style={[styles.strengthText, { color: getSignalColor(carrier.signal_strength) }]}>{carrier.signal_strength}</Text>
                      </View>
                      {carrier.lte_available && <View style={styles.techBadge}><Text style={styles.techText}>LTE</Text></View>}
                      {carrier['5g_available'] && <View style={[styles.techBadge, styles.techBadge5g]}><Text style={styles.techText}>5G</Text></View>}
                      {carrier.satellite && <View style={[styles.techBadge, styles.techBadgeSat]}><Text style={styles.techText}>SAT</Text></View>}
                    </View>
                    {carrier.note && <Text style={styles.carrierNote}>{carrier.note}</Text>}
                  </View>
                ))}
              </View>

              <View style={styles.recommendationBox}><Text style={styles.recommendationText}>{result.recommendation}</Text></View>
              
              <View style={styles.disclaimer}>
                <Ionicons name="information-circle" size={16} color="#6b7280" />
                <Text style={styles.disclaimerText}>Signal estimates based on location type. Actual coverage may vary. For accurate data, check carrier coverage maps.</Text>
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
  button: { backgroundColor: '#3b82f6', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 10 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  errorBox: { backgroundColor: '#450a0a', borderRadius: 8, padding: 12, marginTop: 12 },
  errorText: { color: '#fca5a5', fontSize: 14 },
  resultContainer: { marginTop: 20, gap: 16 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultLocation: { color: '#fff', fontSize: 18, fontWeight: '700', flex: 1 },
  overallBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  overallText: { fontSize: 14, fontWeight: '700' },
  carriersContainer: { gap: 12 },
  carrierCard: { backgroundColor: '#27272a', borderRadius: 12, padding: 14 },
  carrierHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  carrierName: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 },
  signalBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  signalBar: { width: 6, borderRadius: 2 },
  signalBarFilled: { backgroundColor: '#10b981' },
  signalBarEmpty: { backgroundColor: '#3f3f46' },
  carrierDetails: { flexDirection: 'row', gap: 8 },
  strengthBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  strengthText: { fontSize: 12, fontWeight: '600' },
  techBadge: { backgroundColor: '#1e40af', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  techBadge5g: { backgroundColor: '#7c3aed' },
  techBadgeSat: { backgroundColor: '#0891b2' },
  techText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  carrierNote: { color: '#9ca3af', fontSize: 12, marginTop: 8, fontStyle: 'italic' },
  recommendationBox: { backgroundColor: '#1e3a5f', borderRadius: 10, padding: 14 },
  recommendationText: { color: '#93c5fd', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  disclaimer: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  disclaimerText: { color: '#6b7280', fontSize: 11, flex: 1 },
});
