import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Linking, RefreshControl, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import axios from 'axios';
import { API_BASE } from '../lib/apiConfig';

interface PlaceResult {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number | null;
  distance_miles: number | null;
  place_id: string;
}

interface GeocodeSuggestion { place_name: string; short_name: string; coordinates: [number, number]; }

export default function RVDealershipScreen() {
  const router = useRouter();
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lon: number; name: string } | null>(null);
  const [gettingLocation, setGettingLocation] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { getCurrentLocation(); }, []);

  const getCurrentLocation = async () => {
    setGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCurrentLocation({ lat: loc.coords.latitude, lon: loc.coords.longitude, name: 'Current Location' });
        searchPlaces(loc.coords.latitude, loc.coords.longitude);
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
    searchPlaces(lat, lon);
  };

  const searchPlaces = async (lat: number, lon: number) => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_BASE}/api/boondocking/rv-dealers`, { params: { latitude: lat, longitude: lon, radius_miles: 75 } });
      setResults(response.data.results || []);
      if (response.data.results?.length === 0) setError('No RV dealerships found within 75 miles');
    } catch (err: any) { setError(err?.response?.data?.detail || 'Failed to search'); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const onRefresh = () => { setRefreshing(true); currentLocation ? searchPlaces(currentLocation.lat, currentLocation.lon) : getCurrentLocation(); };
  const openInMaps = (place: PlaceResult) => { Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`); };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}><Ionicons name="arrow-back" size={24} color="#fff" /><Text style={styles.backText}>Back</Text></TouchableOpacity>
        <TouchableOpacity onPress={getCurrentLocation} disabled={gettingLocation}>{gettingLocation ? <ActivityIndicator size="small" color="#ec4899" /> : <Ionicons name="locate" size={24} color="#ec4899" />}</TouchableOpacity>
      </View>

      <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ec4899" />} keyboardShouldPersistTaps="handled">
        <View style={styles.titleSection}>
          <Text style={styles.title}>🚐 RV Dealerships</Text>
          <Text style={styles.subtitle}>Find RV dealers for service, parts, or repairs (75 mile radius)</Text>
        </View>

        <View style={styles.searchSection}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color="#6b7280" style={{ marginRight: 8 }} />
            <TextInput style={styles.searchInput} value={searchQuery} onChangeText={handleSearchQueryChange} placeholder="Search city or address..." placeholderTextColor="#6b7280" />
            {searchQuery.length > 0 && <TouchableOpacity onPress={() => { setSearchQuery(''); setSuggestions([]); }}><Ionicons name="close-circle" size={20} color="#6b7280" /></TouchableOpacity>}
          </View>
          {showSuggestions && suggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              {suggestions.map((s, i) => <TouchableOpacity key={i} style={styles.suggestionItem} onPress={() => selectLocation(s)}><Ionicons name="location" size={16} color="#ec4899" /><Text style={styles.suggestionText}>{s.place_name}</Text></TouchableOpacity>)}
            </View>
          )}
          {currentLocation && <View style={styles.locationBadge}><Ionicons name="location" size={14} color="#10b981" /><Text style={styles.locationText}>Searching near: {currentLocation.name}</Text></View>}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#ec4899" /><Text style={styles.loadingText}>Finding RV dealerships...</Text></View>
        ) : error && results.length === 0 ? (
          <View style={styles.errorContainer}><Ionicons name="alert-circle" size={48} color="#f59e0b" /><Text style={styles.errorText}>{error}</Text></View>
        ) : (
          <View style={styles.resultsContainer}>
            {results.length > 0 && <Text style={styles.resultsCount}>{results.length} dealerships found</Text>}
            {results.map((place, index) => (
              <TouchableOpacity key={place.place_id || index} style={styles.resultCard} onPress={() => openInMaps(place)} activeOpacity={0.7}>
                <View style={styles.resultHeader}>
                  <View style={styles.iconContainer}><Ionicons name="car-sport" size={24} color="#ec4899" /></View>
                  <View style={styles.resultInfo}><Text style={styles.resultName}>{place.name}</Text><Text style={styles.resultAddress}>{place.address}</Text></View>
                </View>
                <View style={styles.resultMeta}>
                  <View style={styles.metaItem}><Ionicons name="navigate" size={16} color="#60a5fa" /><Text style={styles.metaText}>{place.distance_miles} mi</Text></View>
                  {place.rating && <View style={styles.metaItem}><Ionicons name="star" size={16} color="#eab308" /><Text style={styles.metaText}>{place.rating}</Text></View>}
                </View>
                <View style={styles.tapHint}><Ionicons name="map" size={16} color="#60a5fa" /><Text style={styles.tapHintText}>Tap for directions</Text></View>
              </TouchableOpacity>
            ))}
          </View>
        )}
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
  titleSection: { padding: 16, paddingBottom: 8 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#a1a1aa', fontSize: 14, lineHeight: 20 },
  searchSection: { paddingHorizontal: 16, marginBottom: 16, zIndex: 10 },
  searchInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#27272a', borderRadius: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#3f3f46' },
  searchInput: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 12 },
  suggestionsContainer: { backgroundColor: '#27272a', borderRadius: 10, marginTop: 4, borderWidth: 1, borderColor: '#3f3f46' },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: '#3f3f46' },
  suggestionText: { color: '#e4e4e7', fontSize: 14, flex: 1 },
  locationBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  locationText: { color: '#10b981', fontSize: 13, fontWeight: '500' },
  loadingContainer: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  loadingText: { color: '#a1a1aa', fontSize: 14 },
  errorContainer: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  errorText: { color: '#fbbf24', fontSize: 15, textAlign: 'center' },
  resultsContainer: { paddingHorizontal: 16, gap: 12 },
  resultsCount: { color: '#a1a1aa', fontSize: 13, marginBottom: 4 },
  resultCard: { backgroundColor: '#18181b', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#27272a' },
  resultHeader: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  iconContainer: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#500724', alignItems: 'center', justifyContent: 'center' },
  resultInfo: { flex: 1 },
  resultName: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  resultAddress: { color: '#a1a1aa', fontSize: 13 },
  resultMeta: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: '#d4d4d8', fontSize: 13 },
  tapHint: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#27272a' },
  tapHintText: { color: '#60a5fa', fontSize: 13 },
});
