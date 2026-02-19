import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Linking, RefreshControl, TextInput, Alert } from 'react-native';
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
  total_ratings: number | null;
  distance_miles: number | null;
  is_open: boolean | null;
  place_id: string;
}

// Default location (Las Vegas for casinos)
const DEFAULT_LAT = 36.1699;
const DEFAULT_LON = -115.1398;

export default function CasinosScreen() {
  const router = useRouter();
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [latitude, setLatitude] = useState(DEFAULT_LAT.toString());
  const [longitude, setLongitude] = useState(DEFAULT_LON.toString());
  const [locationName, setLocationName] = useState('Las Vegas, NV (default)');
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    // Try to get current location, but search immediately with default
    getCurrentLocation();
    searchPlaces(DEFAULT_LAT, DEFAULT_LON);
  }, []);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLatitude(loc.coords.latitude.toFixed(4));
        setLongitude(loc.coords.longitude.toFixed(4));
        setLocationName('Current Location');
        // Re-search with actual location
        searchPlaces(loc.coords.latitude, loc.coords.longitude);
      }
    } catch (err) {
      console.log('Location not available, using default');
    }
  };

  const searchPlaces = async (lat: number, lon: number) => {
    setLoading(true);
    setError('');
    setHasSearched(true);
    try {
      const response = await axios.get(`${API_BASE}/api/boondocking/casinos`, {
        params: { latitude: lat, longitude: lon, radius_miles: 100 }
      });
      setResults(response.data.results || []);
      if (response.data.results?.length === 0) {
        setError('No casinos found within 100 miles');
      }
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err?.response?.data?.detail || 'Failed to search. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSearch = () => {
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lon)) {
      Alert.alert('Invalid Location', 'Please enter valid coordinates');
      return;
    }
    setLocationName('Custom Location');
    searchPlaces(lat, lon);
  };

  const onRefresh = () => {
    setRefreshing(true);
    searchPlaces(parseFloat(latitude), parseFloat(longitude));
  };

  const openInMaps = (place: PlaceResult) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`;
    Linking.openURL(url);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={getCurrentLocation} style={styles.refreshButton}>
          <Ionicons name="locate" size={24} color="#eab308" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#eab308" />}
      >
        <View style={styles.titleSection}>
          <Text style={styles.title}>🎰 Casinos Near Me</Text>
          <Text style={styles.subtitle}>Many casinos allow overnight RV parking - always call ahead to confirm</Text>
        </View>

        {/* Location Input */}
        <View style={styles.locationSection}>
          <View style={styles.locationBadge}>
            <Ionicons name="location" size={14} color="#eab308" />
            <Text style={styles.locationText}>{locationName}</Text>
          </View>
          <View style={styles.coordsRow}>
            <TextInput
              style={styles.coordInput}
              value={latitude}
              onChangeText={setLatitude}
              placeholder="Latitude"
              placeholderTextColor="#6b7280"
              keyboardType="numeric"
            />
            <TextInput
              style={styles.coordInput}
              value={longitude}
              onChangeText={setLongitude}
              placeholder="Longitude"
              placeholderTextColor="#6b7280"
              keyboardType="numeric"
            />
            <TouchableOpacity onPress={handleSearch} style={styles.searchBtn}>
              <Ionicons name="search" size={20} color="#1a1a1a" />
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#eab308" />
            <Text style={styles.loadingText}>Finding casinos...</Text>
          </View>
        ) : error && results.length === 0 ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={48} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={handleSearch} style={styles.retryButton}>
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsCount}>{results.length} casinos found</Text>
            {results.map((place, index) => (
              <TouchableOpacity 
                key={place.place_id || index}
                style={styles.resultCard}
                onPress={() => openInMaps(place)}
                activeOpacity={0.7}
              >
                <View style={styles.resultHeader}>
                  <View style={styles.iconContainer}>
                    <Ionicons name="game-controller" size={24} color="#eab308" />
                  </View>
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultName}>{place.name}</Text>
                    <Text style={styles.resultAddress}>{place.address}</Text>
                  </View>
                </View>
                <View style={styles.resultMeta}>
                  <View style={styles.metaItem}>
                    <Ionicons name="navigate" size={16} color="#60a5fa" />
                    <Text style={styles.metaText}>{place.distance_miles} mi</Text>
                  </View>
                  {place.rating && (
                    <View style={styles.metaItem}>
                      <Ionicons name="star" size={16} color="#eab308" />
                      <Text style={styles.metaText}>{place.rating}</Text>
                    </View>
                  )}
                  {place.is_open !== null && (
                    <View style={[styles.statusBadge, place.is_open ? styles.openBadge : styles.closedBadge]}>
                      <Text style={styles.statusText}>{place.is_open ? 'Open' : 'Closed'}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.tapHint}>
                  <Ionicons name="map" size={16} color="#60a5fa" />
                  <Text style={styles.tapHintText}>Tap for directions</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.disclaimer}>
          <Ionicons name="information-circle" size={20} color="#6b7280" />
          <Text style={styles.disclaimerText}>
            Always call ahead to confirm overnight parking is allowed. Policies vary by location.
          </Text>
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
  refreshButton: { padding: 8 },
  content: { flex: 1 },
  titleSection: { padding: 16, paddingBottom: 8 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#a1a1aa', fontSize: 14, lineHeight: 20 },
  locationSection: { paddingHorizontal: 16, marginBottom: 16 },
  locationBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  locationText: { color: '#eab308', fontSize: 13, fontWeight: '500' },
  coordsRow: { flexDirection: 'row', gap: 8 },
  coordInput: { flex: 1, backgroundColor: '#27272a', color: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, borderWidth: 1, borderColor: '#3f3f46' },
  searchBtn: { backgroundColor: '#eab308', width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  loadingContainer: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  loadingText: { color: '#a1a1aa', fontSize: 14 },
  errorContainer: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  errorText: { color: '#ef4444', fontSize: 16, textAlign: 'center' },
  retryButton: { backgroundColor: '#27272a', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 8 },
  retryText: { color: '#fff', fontWeight: '600' },
  resultsContainer: { paddingHorizontal: 16, gap: 12 },
  resultsCount: { color: '#a1a1aa', fontSize: 13, marginBottom: 4 },
  resultCard: { backgroundColor: '#18181b', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#27272a' },
  resultHeader: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  iconContainer: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#422006', alignItems: 'center', justifyContent: 'center' },
  resultInfo: { flex: 1 },
  resultName: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  resultAddress: { color: '#a1a1aa', fontSize: 13 },
  resultMeta: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: '#d4d4d8', fontSize: 13 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  openBadge: { backgroundColor: '#052e16' },
  closedBadge: { backgroundColor: '#450a0a' },
  statusText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  tapHint: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#27272a' },
  tapHintText: { color: '#60a5fa', fontSize: 13 },
  disclaimer: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 16, margin: 16, backgroundColor: '#1c1917', borderRadius: 8 },
  disclaimerText: { color: '#6b7280', fontSize: 12, flex: 1, lineHeight: 18 },
});
