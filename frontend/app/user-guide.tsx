import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Image,
  Dimensions 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface GuideSection {
  id: string;
  title: string;
  icon: string;
  color: string;
  description: string;
  steps: string[];
  tips: string[];
}

const guideSections: GuideSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: 'rocket',
    color: '#8b5cf6',
    description: 'Welcome to RouteCast! Your all-in-one weather and route planning companion for RVers, truckers, and travelers.',
    steps: [
      'Enter your origin and destination on the home screen',
      'Select your vehicle type (RV, Pickup, Sedan, or Tractor Trailer)',
      'Tap "Get Route Forecast" to see weather along your route',
      'Review hourly forecasts, road conditions, and hazard alerts'
    ],
    tips: [
      'Enable location services for automatic route starting point',
      'Use voice input by tapping the microphone icon',
      'Swipe down to refresh forecasts with latest data'
    ]
  },
  {
    id: 'boondockers',
    title: 'Boondockers Features',
    icon: 'bonfire',
    color: '#8b4513',
    description: 'Access specialized tools for off-grid camping and RV living.',
    steps: [
      'From the route screen, tap the Boondockers card',
      'Choose from features like Free Camping, Dump Stations, or Solar Forecast',
      'Your location is automatically detected - tap refresh to update',
      'Results are sorted by distance from your current position'
    ],
    tips: [
      'Check Campsite Index for a quality score of any GPS location',
      'Use Water Budget and Propane Usage before long boondocking trips',
      'Wind Shelter helps you orient your RV for best protection'
    ]
  },
  {
    id: 'tractor-trailer',
    title: 'Tractor Trailer Features',
    icon: 'bus',
    color: '#3b82f6',
    description: 'Professional tools designed for commercial truck drivers.',
    steps: [
      'From the route screen, tap the Tractor Trailer card',
      'Search for Truck Stops, Weigh Stations, or Parking',
      'View truck restrictions and low clearance warnings',
      'Find truck services and repair shops nearby'
    ],
    tips: [
      'Always check Low Clearance alerts before unfamiliar routes',
      'Use Truck Parking feature during HOS rest requirements',
      'Weigh Stations shows open/closed status when available'
    ]
  },
  {
    id: 'weather-features',
    title: 'Weather & Alerts',
    icon: 'thunderstorm',
    color: '#eab308',
    description: 'Stay informed about weather conditions along your route.',
    steps: [
      'View hourly forecasts for each waypoint on your route',
      'Check the Hazards tab for severe weather alerts',
      'Road conditions show precipitation, wind, and temperature risks',
      'Weather Radar provides real-time precipitation maps'
    ],
    tips: [
      'Red alerts indicate severe conditions - consider delaying travel',
      'Wind speeds over 40mph may affect high-profile vehicles',
      'Check precipitation timing to plan rest stops strategically'
    ]
  },
  {
    id: 'ai-assistant',
    title: 'AI Chat Assistant',
    icon: 'chatbubbles',
    color: '#06b6d4',
    description: 'Ask questions about your route, weather, or get travel recommendations.',
    steps: [
      'Tap the chat bubble icon in the bottom right',
      'Type your question or use voice input',
      'Get personalized recommendations based on your route',
      'Ask follow-up questions for more details'
    ],
    tips: [
      'Ask "What should I watch out for on this route?"',
      'Request rest stop recommendations for specific times',
      'Get advice on best travel times to avoid weather'
    ]
  },
  {
    id: 'notifications',
    title: 'Push Notifications',
    icon: 'notifications',
    color: '#ef4444',
    description: 'Receive alerts about weather changes and hazards.',
    steps: [
      'Enable notifications when prompted on first launch',
      'Receive alerts for severe weather along saved routes',
      'Get notified when conditions improve or worsen',
      'Customize alert preferences in device settings'
    ],
    tips: [
      'Critical alerts are sent for tornado, flash flood warnings',
      'Smart Delay feature suggests optimal departure times',
      'Disable notifications temporarily in your device settings if needed'
    ]
  }
];

export default function UserGuideScreen() {
  const router = useRouter();
  const [expandedSection, setExpandedSection] = useState<string | null>('getting-started');

  const toggleSection = (sectionId: string) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>User Guide</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Welcome Banner */}
        <View style={styles.welcomeBanner}>
          <View style={styles.welcomeIcon}>
            <Ionicons name="book" size={32} color="#8b5cf6" />
          </View>
          <Text style={styles.welcomeTitle}>Welcome to RouteCast</Text>
          <Text style={styles.welcomeSubtitle}>
            Your complete guide to weather-smart travel planning
          </Text>
        </View>

        {/* Quick Start */}
        <View style={styles.quickStart}>
          <Text style={styles.quickStartTitle}>Quick Start</Text>
          <View style={styles.quickStartSteps}>
            <View style={styles.quickStep}>
              <View style={[styles.stepNumber, { backgroundColor: '#8b5cf6' }]}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.stepText}>Enter your route</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color="#4b5563" />
            <View style={styles.quickStep}>
              <View style={[styles.stepNumber, { backgroundColor: '#06b6d4' }]}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepText}>View forecast</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color="#4b5563" />
            <View style={styles.quickStep}>
              <View style={[styles.stepNumber, { backgroundColor: '#22c55e' }]}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.stepText}>Travel safely</Text>
            </View>
          </View>
        </View>

        {/* Feature Sections */}
        <Text style={styles.sectionHeader}>Features & How-To</Text>
        
        {guideSections.map((section) => (
          <TouchableOpacity
            key={section.id}
            style={styles.sectionCard}
            onPress={() => toggleSection(section.id)}
            activeOpacity={0.7}
          >
            <View style={styles.sectionTop}>
              <View style={[styles.sectionIcon, { backgroundColor: `${section.color}20` }]}>
                <Ionicons name={section.icon as any} size={24} color={section.color} />
              </View>
              <View style={styles.sectionInfo}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionDesc} numberOfLines={expandedSection === section.id ? undefined : 1}>
                  {section.description}
                </Text>
              </View>
              <Ionicons 
                name={expandedSection === section.id ? 'chevron-up' : 'chevron-down'} 
                size={20} 
                color="#9ca3af" 
              />
            </View>

            {expandedSection === section.id && (
              <View style={styles.sectionExpanded}>
                <View style={styles.stepsContainer}>
                  <Text style={styles.stepsHeader}>How to use:</Text>
                  {section.steps.map((step, index) => (
                    <View key={index} style={styles.stepItem}>
                      <View style={styles.stepBullet}>
                        <Text style={styles.stepBulletText}>{index + 1}</Text>
                      </View>
                      <Text style={styles.stepItemText}>{step}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.tipsContainer}>
                  <Text style={styles.tipsHeader}>💡 Pro Tips:</Text>
                  {section.tips.map((tip, index) => (
                    <View key={index} style={styles.tipItem}>
                      <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                      <Text style={styles.tipItemText}>{tip}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </TouchableOpacity>
        ))}

        {/* Support Section */}
        <View style={styles.supportCard}>
          <Ionicons name="help-circle" size={24} color="#8b5cf6" />
          <View style={styles.supportInfo}>
            <Text style={styles.supportTitle}>Need More Help?</Text>
            <Text style={styles.supportText}>
              Contact support or check our FAQ for additional assistance.
            </Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  welcomeBanner: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#8b5cf620',
  },
  welcomeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#8b5cf620',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  welcomeTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
  },
  quickStart: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  quickStartTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  quickStartSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  quickStep: {
    alignItems: 'center',
    gap: 6,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  stepText: {
    color: '#9ca3af',
    fontSize: 11,
    textAlign: 'center',
  },
  sectionHeader: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  sectionCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  sectionTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionInfo: {
    flex: 1,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionDesc: {
    color: '#9ca3af',
    fontSize: 13,
    lineHeight: 18,
  },
  sectionExpanded: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#27272a',
  },
  stepsContainer: {
    marginBottom: 16,
  },
  stepsHeader: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  stepBullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#27272a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  stepBulletText: {
    color: '#06b6d4',
    fontSize: 12,
    fontWeight: '600',
  },
  stepItemText: {
    color: '#d4d4d8',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  tipsContainer: {
    backgroundColor: '#0d2818',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#22c55e30',
  },
  tipsHeader: {
    color: '#22c55e',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  tipItemText: {
    color: '#a7f3d0',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#8b5cf620',
    gap: 12,
  },
  supportInfo: {
    flex: 1,
  },
  supportTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  supportText: {
    color: '#9ca3af',
    fontSize: 13,
  },
});
