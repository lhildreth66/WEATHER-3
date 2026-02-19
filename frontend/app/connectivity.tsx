import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import axios from 'axios';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { API_BASE } from '../lib/apiConfig';

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
  latitude: number;
  longitude: number;
  location_name: string;
  carriers: CarrierInfo[];
  overall_rating: string;
  recommendation: string;
}

export default function ConnectivityScreen() {
  const router = useRouter();
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);
  const [result, setResult] = useState<ConnectivityResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
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
    setResult(null);
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

  const checkConnectivity = async () => {
    if (!latitude || !longitude) {
      setError('Location required');
      return;
    }

    setLoading(true);
    setResult(null);
    setError('');
    try {
      const resp = await axios.get(`${API_BASE}/api/boondocking/connectivity`, {
        params: {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
        },
      });
      setResult(resp.data);
    } catch (err: any) {
      console.error('Connectivity check error:', err);
      setError(err?.response?.data?.detail || 'Failed to check connectivity');
    } finally {
      setLoading(false);
    }
  };

  const getSignalBars = (bars: number) => {
    const filled = Math.min(5, Math.max(0, bars));
    return (
      <View style={styles.signalBars}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            style={[
              styles.signalBar,
              { height: 6 + i * 4 },
              i <= filled ? styles.signalBarFilled : styles.signalBarEmpty,
            ]}
          />
        ))}
      </View>
    );
  };

  const getSignalColor = (strength: string) => {
    switch (strength.toLowerCase()) {
      case 'excellent': return '#10b981';
      case 'good': return '#22c55e';
      case 'fair': return '#eab308';
      case 'weak': return '#f59e0b';
      case 'poor': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getCarrierIcon = (name: string) => {
    if (name === 'Starlink') return 'planet';
    return 'cellular';
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
            <ActivityIndicator size="small" color="#60a5fa" />
          ) : (
            <Ionicons name="locate" size={24} color="#60a5fa" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>📡 Connectivity Check</Text>
          <Text style={styles.subtitle}>Check cell signal and internet options at your location</Text>

          {latitude && longitude && (
            <View style={styles.locationBadge}>
              <Ionicons name="location" size={14} color="#60a5fa" />
              <Text style={styles.locationText}>{latitude}, {longitude}</Text>
            </View>
          )}

          <TouchableOpacity onPress={checkConnectivity} style={styles.button} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#1a1a1a" />
            ) : (
              <>
                <Ionicons name="wifi" size={20} color="#1a1a1a" />
                <Text style={styles.buttonText}>Check Signal</Text>
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
                <Text style={styles.resultLocation}>{result.location_name}</Text>
                <View style={[styles.overallBadge, { backgroundColor: getSignalColor(result.overall_rating) + '30' }]}>
                  <Text style={[styles.overallText, { color: getSignalColor(result.overall_rating) }]}>
                    {result.overall_rating}
                  </Text>
                </View>
              </View>

              <View style={styles.carriersContainer}>
                {result.carriers.map((carrier, index) => (
                  <View key={index} style={styles.carrierCard}>
                    <View style={styles.carrierHeader}>
                      <Ionicons 
                        name={getCarrierIcon(carrier.name) as any} 
                        size={24} 
                        color={getSignalColor(carrier.signal_strength)} 
                      />
                      <Text style={styles.carrierName}>{carrier.name}</Text>
                      {getSignalBars(carrier.signal_bars)}
                    </View>
                    <View style={styles.carrierDetails}>
                      <View style={[styles.strengthBadge, { backgroundColor: getSignalColor(carrier.signal_strength) + '30' }]}>
                        <Text style={[styles.strengthText, { color: getSignalColor(carrier.signal_strength) }]}>
                          {carrier.signal_strength}
                        </Text>
                      </View>
                      {carrier.lte_available && (
                        <View style={styles.techBadge}>
                          <Text style={styles.techText}>LTE</Text>
                        </View>
                      )}
                      {carrier['5g_available'] && (
                        <View style={[styles.techBadge, styles.techBadge5g]}>
                          <Text style={styles.techText}>5G</Text>
                        </View>
                      )}
                      {carrier.satellite && (
                        <View style={[styles.techBadge, styles.techBadgeSat]}>
                          <Text style={styles.techText}>SAT</Text>
                        </View>
                      )}
                    </View>
                    {carrier.note && (
                      <Text style={styles.carrierNote}>{carrier.note}</Text>
                    )}
                  </View>
                ))}
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
  button: { backgroundColor: '#3b82f6', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 10 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#450a0a', borderRadius: 8, padding: 12, marginTop: 12 },
  errorText: { color: '#fca5a5', fontSize: 14, flex: 1 },
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
});
