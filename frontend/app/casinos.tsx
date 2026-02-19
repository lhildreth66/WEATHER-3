import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Linking, RefreshControl } from 'react-native';
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

export default function CasinosScreen() {
  const router = useRouter();
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission required');
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setLocation({ lat: loc.coords.latitude, lon: loc.coords.longitude });
      searchPlaces(loc.coords.latitude, loc.coords.longitude);
    } catch (err) {
      setError('Could not get location');
      setLoading(false);
    }
  };

  const searchPlaces = async (lat: number, lon: number) => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_BASE}/api/boondocking/casinos`, {
        params: { latitude: lat, longitude: lon, radius_miles: 50 }
      });
      setResults(response.data.results || []);
      if (response.data.results?.length === 0) {
        setError('No casinos found within 50 miles');
      }
    } catch (err) {
      setError('Failed to search. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (location) {
      searchPlaces(location.lat, location.lon);
    } else {
      getCurrentLocation();
    }
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
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#eab308" />
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

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#eab308" />
            <Text style={styles.loadingText}>Finding casinos...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={48} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={onRefresh} style={styles.retryButton}>
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.resultsContainer}>
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
  titleSection: { padding: 16 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#a1a1aa', fontSize: 14, lineHeight: 20 },
  loadingContainer: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  loadingText: { color: '#a1a1aa', fontSize: 14 },
  errorContainer: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  errorText: { color: '#ef4444', fontSize: 16, textAlign: 'center' },
  retryButton: { backgroundColor: '#27272a', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 8 },
  retryText: { color: '#fff', fontWeight: '600' },
  resultsContainer: { paddingHorizontal: 16, gap: 12 },
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
