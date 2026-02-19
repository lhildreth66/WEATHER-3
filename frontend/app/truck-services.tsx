import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, ScrollView, Linking } from 'react-native';
import axios from 'axios';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { API_BASE } from '../lib/apiConfig';

interface PlaceResult {
  place_id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distance_miles: number;
  rating?: number;
  is_open?: boolean;
  phone?: string;
}

interface LocationData {
  lat: number;
  lon: number;
  name: string;
}

interface AutocompleteSuggestion {
  place_name: string;
  short_name: string;
  coordinates: [number, number];
}

export default function TruckServicesScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    setGettingLocation(true);
    setError('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const locationData = { lat: loc.coords.latitude, lon: loc.coords.longitude, name: 'Current Location' };
        setCurrentLocation(locationData);
        searchPlaces(loc.coords.latitude, loc.coords.longitude);
      } else {
        setError('');
        setCurrentLocation(null);
      }
    } catch (err) {
      setError('');
      setCurrentLocation(null);
    } finally {
      setGettingLocation(false);
    }
  };

  const handleSearchQueryChange = async (text: string) => {
    setSearchQuery(text);
    if (text.length >= 2) {
      try {
        const response = await axios.get(`${API_BASE}/api/geocode/autocomplete`, {
          params: { query: text, limit: 5 }
        });
        setSuggestions(response.data || []);
      } catch (err) {
        console.log('Autocomplete error:', err);
        setSuggestions([]);
      }
    } else {
      setSuggestions([]);
    }
  };

  const selectSuggestion = (suggestion: AutocompleteSuggestion) => {
    const locationData = {
      lat: suggestion.center[1],
      lon: suggestion.center[0],
      name: suggestion.short_name || suggestion.place_name
    };
    setCurrentLocation(locationData);
    setSearchQuery(suggestion.short_name || suggestion.place_name);
    setSuggestions([]);
    searchPlaces(locationData.lat, locationData.lon);
  };

  const searchPlaces = async (lat: number, lon: number) => {
    setLoading(true);
    setError('');
    setResults([]);
    try {
      const resp = await axios.get(`${API_BASE}/api/trucker/repair-services`, {
        params: { latitude: lat, longitude: lon, radius_miles: 50 }
      });
      const mappedResults = (resp.data.results || []).map((place: any) => ({
        place_id: place.place_id,
        name: place.name,
        address: place.address,
        latitude: place.latitude,
        longitude: place.longitude,
        distance_miles: place.distance_miles,
        rating: place.rating,
        is_open: place.is_open,
        phone: place.phone,
      }));
      setResults(mappedResults);
      if (mappedResults.length === 0) {
        setError('No truck services found in this area');
      }
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err?.response?.data?.detail || 'Failed to search. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openInMaps = (place: PlaceResult) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`;
    Linking.openURL(url);
  };

  const callPhone = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color="#fff" />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Ionicons name="construct" size={28} color="#f59e0b" />
            <Text style={styles.title}>Truck Services</Text>
          </View>
          <Text style={styles.subtitle}>Find truck repair, tire shops, and service centers</Text>

          {/* Search Input */}
          <View style={styles.searchSection}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={18} color="#6b7280" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search city or address..."
                placeholderTextColor="#6b7280"
                value={searchQuery}
                onChangeText={handleSearchQueryChange}
                autoComplete="off"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => { setSearchQuery(''); setSuggestions([]); }}>
                  <Ionicons name="close-circle" size={18} color="#6b7280" />
                </TouchableOpacity>
              )}
            </View>
            
            {/* Auto-detect location button */}
            <TouchableOpacity 
              style={styles.detectBtn} 
              onPress={getCurrentLocation}
              disabled={gettingLocation}
            >
              {gettingLocation ? (
                <ActivityIndicator size="small" color="#f59e0b" />
              ) : (
                <Ionicons name="locate" size={22} color="#f59e0b" />
              )}
            </TouchableOpacity>
          </View>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              {suggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionItem}
                  onPress={() => selectSuggestion(suggestion)}
                >
                  <Ionicons name="location" size={18} color="#f59e0b" />
                  <Text style={styles.suggestionText}>{suggestion.place_name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Current location badge */}
          {currentLocation && (
            <View style={styles.locationBadge}>
              <Ionicons name="location" size={14} color="#10b981" />
              <Text style={styles.locationText}>Searching near: {currentLocation.name}</Text>
            </View>
          )}
          
          {/* Prompt when no location */}
          {!currentLocation && !loading && results.length === 0 && !gettingLocation && (
            <View style={styles.promptBox}>
              <Ionicons name="search" size={20} color="#f59e0b" />
              <Text style={styles.promptText}>Enter a city or tap the location icon to find truck services</Text>
            </View>
          )}
        </View>

        {/* Results */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#f59e0b" />
            <Text style={styles.loadingText}>Finding truck services...</Text>
          </View>
        ) : error && results.length === 0 ? (
          <View style={styles.errorContainer}>
            <Ionicons name="construct-outline" size={48} color="#6b7280" />
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorSubtext}>Try searching a different location</Text>
          </View>
        ) : (
          <View style={styles.resultsContainer}>
            {results.length > 0 && (
              <Text style={styles.resultsCount}>{results.length} services found</Text>
            )}
            {results.map((place, index) => (
              <TouchableOpacity 
                key={place.place_id || index}
                style={styles.resultCard}
                onPress={() => openInMaps(place)}
                activeOpacity={0.7}
              >
                <View style={styles.resultHeader}>
                  <View style={styles.iconContainer}>
                    <Ionicons name="construct" size={24} color="#f59e0b" />
                  </View>
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultName}>{place.name}</Text>
                    <Text style={styles.resultAddress}>{place.address}</Text>
                  </View>
                </View>
                <View style={styles.resultMeta}>
                  <View style={styles.metaItem}>
                    <Ionicons name="navigate" size={16} color="#60a5fa" />
                    <Text style={styles.metaText}>{place.distance_miles?.toFixed(1)} mi</Text>
                  </View>
                  {place.rating && (
                    <View style={styles.metaItem}>
                      <Ionicons name="star" size={16} color="#eab308" />
                      <Text style={styles.metaText}>{place.rating}</Text>
                    </View>
                  )}
                  {place.is_open !== null && place.is_open !== undefined && (
                    <View style={[styles.statusBadge, place.is_open ? styles.openBadge : styles.closedBadge]}>
                      <Text style={styles.statusText}>{place.is_open ? 'Open' : 'Closed'}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => openInMaps(place)}>
                    <Ionicons name="map" size={16} color="#60a5fa" />
                    <Text style={styles.actionBtnText}>Directions</Text>
                  </TouchableOpacity>
                  {place.phone && (
                    <TouchableOpacity style={styles.actionBtn} onPress={() => callPhone(place.phone!)}>
                      <Ionicons name="call" size={16} color="#22c55e" />
                      <Text style={[styles.actionBtnText, { color: '#22c55e' }]}>Call</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.disclaimer}>
          <Ionicons name="information-circle" size={20} color="#6b7280" />
          <Text style={styles.disclaimerText}>
            Call ahead to confirm services and availability. Hours may vary.
          </Text>
        </View>
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
  subtitle: { color: '#9ca3af', fontSize: 13, marginBottom: 16 },
  searchSection: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  searchInputContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#27272a', borderRadius: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#3f3f46' },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 12 },
  detectBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#27272a', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#f59e0b30' },
  suggestionsContainer: { backgroundColor: '#27272a', borderRadius: 10, marginTop: 4, borderWidth: 1, borderColor: '#3f3f46', overflow: 'hidden' },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: '#3f3f46' },
  suggestionText: { color: '#e4e4e7', fontSize: 14, flex: 1 },
  locationBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  locationText: { color: '#10b981', fontSize: 13, fontWeight: '500' },
  promptBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#78350f', borderRadius: 10, padding: 14, marginTop: 10 },
  promptText: { color: '#fbbf24', fontSize: 14, fontWeight: '500', flex: 1 },
  loadingContainer: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  loadingText: { color: '#a1a1aa', fontSize: 14 },
  errorContainer: { alignItems: 'center', paddingVertical: 40, gap: 12, paddingHorizontal: 20 },
  errorText: { color: '#f59e0b', fontSize: 15, textAlign: 'center' },
  errorSubtext: { color: '#6b7280', fontSize: 13, textAlign: 'center' },
  resultsContainer: { paddingHorizontal: 16, gap: 12 },
  resultsCount: { color: '#a1a1aa', fontSize: 13, marginBottom: 4 },
  resultCard: { backgroundColor: '#18181b', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#27272a' },
  resultHeader: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  iconContainer: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#78350f', alignItems: 'center', justifyContent: 'center' },
  resultInfo: { flex: 1 },
  resultName: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  resultAddress: { color: '#a1a1aa', fontSize: 13 },
  resultMeta: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: '#d4d4d8', fontSize: 13 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  openBadge: { backgroundColor: '#052e16' },
  closedBadge: { backgroundColor: '#450a0a' },
  statusText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  actionRow: { flexDirection: 'row', gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#27272a' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#27272a', borderRadius: 6 },
  actionBtnText: { color: '#60a5fa', fontSize: 13, fontWeight: '500' },
  disclaimer: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 16, margin: 16, backgroundColor: '#1c1917', borderRadius: 8 },
  disclaimerText: { color: '#6b7280', fontSize: 12, flex: 1, lineHeight: 18 },
});
