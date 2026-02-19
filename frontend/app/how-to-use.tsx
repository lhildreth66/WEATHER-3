import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const SUPPORT_EMAIL = 'support@routecast.com';

interface Step {
  number: number;
  title: string;
  description: string;
  tips?: string[];
}

interface FeatureSection {
  id: string;
  icon: string;
  color: string;
  title: string;
  description: string;
  steps: Step[];
}

const howToSections: FeatureSection[] = [
  {
    id: 'route-weather',
    icon: 'cloud',
    color: '#eab308',
    title: 'Getting Route Weather',
    description: 'See weather conditions along your entire journey',
    steps: [
      {
        number: 1,
        title: 'Enter Your Starting Point',
        description: 'Type your origin address in the "ORIGIN" field. As you type, suggestions will appear - tap one to auto-fill.',
        tips: ['Tap the X button to quickly clear the field', 'Use city names for faster results']
      },
      {
        number: 2,
        title: 'Enter Your Destination',
        description: 'Type your destination in the "DESTINATION" field. Again, use the suggestions for accuracy.',
        tips: ['Tap the swap icon to reverse origin and destination']
      },
      {
        number: 3,
        title: 'Select Your Vehicle Type',
        description: 'Tap "Vehicle Type" to choose your vehicle. This affects safety warnings - RVs and trucks get bridge height and wind alerts.',
        tips: ['Enable "Trucker Mode" for commercial truck features', 'Enter your vehicle height for low clearance warnings']
      },
      {
        number: 4,
        title: 'Get Your Forecast',
        description: 'Tap "CHECK ROUTE WEATHER" to see weather conditions at every point along your route.',
        tips: ['Results show temperature, conditions, and road hazards', 'Tap "Alerts" tab for detailed weather warnings']
      }
    ]
  },
  {
    id: 'boondockers',
    icon: 'bonfire',
    color: '#8b4513',
    title: 'Using Boondocker Features',
    description: 'Tools for off-grid camping and RV living',
    steps: [
      {
        number: 1,
        title: 'Access Boondocker Tools',
        description: 'From the home screen, tap the "Boondockers" button. You\'ll see a menu of all available tools.',
      },
      {
        number: 2,
        title: 'Find Places Near You',
        description: 'Features like "Casinos", "Walmart Parking", and "Dump Stations" search for locations near your position. Make sure location is enabled, or type a city/address in the search bar.',
        tips: ['Results are sorted by distance', 'Tap any result to get directions in Google Maps']
      },
      {
        number: 3,
        title: 'Use Planning Tools',
        description: 'Tools like "Solar Forecast", "Propane Usage", and "Water Budget" help you plan resources. Enter your specs (panel wattage, tank sizes, etc.) to get estimates.',
        tips: ['Water Budget now includes Fresh, Gray, and Black tank calculations']
      },
      {
        number: 4,
        title: 'Check Your Campsite',
        description: 'Use "Campsite Index" to get a suitability score for any location. Enter coordinates or use current location to check wind, cell signal, and access.',
      }
    ]
  },
  {
    id: 'truck-drivers',
    icon: 'bus',
    color: '#3b82f6',
    title: 'Using Truck Driver Features',
    description: 'Professional tools for commercial drivers',
    steps: [
      {
        number: 1,
        title: 'Enable Trucker Mode',
        description: 'On the home screen, toggle "Trucker Mode" ON. This activates bridge clearance alerts and wind warnings for high-profile vehicles.',
        tips: ['Enter your vehicle height in feet for accurate clearance warnings']
      },
      {
        number: 2,
        title: 'Access Truck Tools',
        description: 'Tap "Truck Drivers" button to access truck-specific features like fuel stops, weigh stations, parking, and repair services.',
      },
      {
        number: 3,
        title: 'Find Truck Stops & Fuel',
        description: 'Search for truck stops with diesel, DEF, and amenities. Results show distance and ratings.',
      },
      {
        number: 4,
        title: 'Check Bridge Clearances',
        description: 'After entering a route with Trucker Mode ON, check the "Bridge Height Hazards" section on the route results page for low clearance warnings.',
        tips: ['Alerts show bridges below your entered vehicle height', 'Always verify with current signage']
      }
    ]
  },
  {
    id: 'weather-alerts',
    icon: 'warning',
    color: '#ef4444',
    title: 'Understanding Weather Alerts',
    description: 'Stay safe with real-time hazard warnings',
    steps: [
      {
        number: 1,
        title: 'View Alerts on Route',
        description: 'After checking a route, tap the "Alerts" tab to see active weather warnings along your path.',
        tips: ['Red = Severe/Extreme', 'Yellow/Orange = Moderate', 'Tap any alert to expand details']
      },
      {
        number: 2,
        title: 'Understand Alert Types',
        description: 'Alerts include Winter Storm, Wind, Flood, Tornado, and more. Each shows distance to hazard and ETA.',
      },
      {
        number: 3,
        title: 'Follow Recommendations',
        description: 'Each alert includes a recommendation (slow down, find shelter, delay travel, etc.). Follow these for safety.',
      },
      {
        number: 4,
        title: 'Use Live Radar',
        description: 'Tap the "Radar" button to see a live weather radar map overlaid with NWS alert zones.',
        tips: ['Pinch to zoom', 'Toggle radar layer on/off for clarity']
      }
    ]
  },
  {
    id: 'ai-assistant',
    icon: 'chatbubbles',
    color: '#8b5cf6',
    title: 'Using the AI Assistant',
    description: 'Get personalized travel advice',
    steps: [
      {
        number: 1,
        title: 'Open the Chat',
        description: 'Tap the yellow chat bubble in the bottom-right corner of any screen.',
      },
      {
        number: 2,
        title: 'Ask Questions',
        description: 'Type or speak your question. The AI knows your current route context and can provide specific advice.',
        tips: ['Try: "What should I watch out for on this route?"', 'Or: "Is it safe to drive through the storm?"']
      },
      {
        number: 3,
        title: 'Use Suggestions',
        description: 'Quick suggestion buttons help you ask common questions with one tap.',
      }
    ]
  }
];

const faqItems = [
  {
    question: 'Why is my location not being detected?',
    answer: 'Make sure location services are enabled in your browser/device settings. On web, you may need to grant permission when prompted. If it still doesn\'t work, use the search bar to manually enter a city or address.'
  },
  {
    question: 'How accurate is the weather data?',
    answer: 'Weather data comes from the National Weather Service (NOAA), the official US weather agency. Forecasts are generally accurate within 1-2 degrees for temperature and timing. Alerts are pulled directly from NWS active warnings.'
  },
  {
    question: 'Do the "Places Near Me" features work everywhere?',
    answer: 'Yes, these features use Google Places API and work throughout the United States. Results depend on Google\'s database of business listings.'
  },
  {
    question: 'How do I clear my entered addresses quickly?',
    answer: 'Tap the small "X" icon that appears on the right side of any address input field to instantly clear it.'
  },
  {
    question: 'What does the Safety Score mean?',
    answer: 'The Safety Score (0-100) rates your route based on weather hazards, road conditions, and visibility. Higher is safer. Scores below 60 indicate caution is needed.'
  },
  {
    question: 'Can I use this app offline?',
    answer: 'The app requires an internet connection to fetch weather data and search for places. Previously loaded routes are cached for limited offline viewing.'
  }
];

export default function HowToUseScreen() {
  const router = useRouter();
  const [expandedSection, setExpandedSection] = useState<string | null>('route-weather');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const toggleSection = (sectionId: string) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
  };

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const openEmail = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} data-testid="back-button">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>How To Use RouteCast</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Welcome Banner */}
        <View style={styles.welcomeBanner}>
          <Ionicons name="book" size={40} color="#eab308" />
          <Text style={styles.welcomeTitle}>Welcome to RouteCast</Text>
          <Text style={styles.welcomeSubtitle}>
            Your complete guide to using all the features of the app. Tap any section below to learn more.
          </Text>
        </View>

        {/* Quick Tips */}
        <View style={styles.quickTips}>
          <Text style={styles.quickTipsTitle}>Quick Tips</Text>
          <View style={styles.tipRow}>
            <View style={styles.tipItem}>
              <Ionicons name="close-circle" size={20} color="#ef4444" />
              <Text style={styles.tipText}>Tap X to clear addresses</Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="swap-vertical" size={20} color="#60a5fa" />
              <Text style={styles.tipText}>Swap origin & destination</Text>
            </View>
          </View>
          <View style={styles.tipRow}>
            <View style={styles.tipItem}>
              <Ionicons name="chatbubble-ellipses" size={20} color="#eab308" />
              <Text style={styles.tipText}>Chat for personalized help</Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="radio" size={20} color="#22c55e" />
              <Text style={styles.tipText}>Tap Radar for live weather</Text>
            </View>
          </View>
        </View>

        {/* How-To Sections */}
        <Text style={styles.sectionHeader}>Step-by-Step Guides</Text>
        {howToSections.map((section) => (
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
                <Text style={styles.sectionDesc}>{section.description}</Text>
              </View>
              <Ionicons 
                name={expandedSection === section.id ? 'chevron-up' : 'chevron-down'} 
                size={20} 
                color="#9ca3af" 
              />
            </View>

            {expandedSection === section.id && (
              <View style={styles.stepsContainer}>
                {section.steps.map((step) => (
                  <View key={step.number} style={styles.stepItem}>
                    <View style={[styles.stepNumber, { backgroundColor: `${section.color}30` }]}>
                      <Text style={[styles.stepNumberText, { color: section.color }]}>{step.number}</Text>
                    </View>
                    <View style={styles.stepContent}>
                      <Text style={styles.stepTitle}>{step.title}</Text>
                      <Text style={styles.stepDesc}>{step.description}</Text>
                      {step.tips && step.tips.length > 0 && (
                        <View style={styles.stepTips}>
                          {step.tips.map((tip, idx) => (
                            <View key={idx} style={styles.stepTipRow}>
                              <Ionicons name="bulb" size={12} color="#fbbf24" />
                              <Text style={styles.stepTipText}>{tip}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </TouchableOpacity>
        ))}

        {/* FAQ Section */}
        <Text style={styles.sectionHeader}>Frequently Asked Questions</Text>
        <View style={styles.faqContainer}>
          {faqItems.map((faq, index) => (
            <TouchableOpacity
              key={index}
              style={styles.faqItem}
              onPress={() => toggleFaq(index)}
              activeOpacity={0.7}
            >
              <View style={styles.faqQuestion}>
                <Ionicons name="help-circle" size={20} color="#60a5fa" />
                <Text style={styles.faqQuestionText}>{faq.question}</Text>
                <Ionicons 
                  name={expandedFaq === index ? 'chevron-up' : 'chevron-down'} 
                  size={18} 
                  color="#6b7280" 
                />
              </View>
              {expandedFaq === index && (
                <View style={styles.faqAnswer}>
                  <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Support Section */}
        <View style={styles.supportCard}>
          <View style={styles.supportIconRow}>
            <View style={styles.supportIcon}>
              <Ionicons name="mail" size={24} color="#8b5cf6" />
            </View>
          </View>
          <Text style={styles.supportTitle}>Need More Help?</Text>
          <Text style={styles.supportText}>
            Our support team is here to help with any questions or issues you may have.
          </Text>
          <TouchableOpacity style={styles.supportButton} onPress={openEmail}>
            <Ionicons name="send" size={18} color="#fff" />
            <Text style={styles.supportButtonText}>Contact Support</Text>
          </TouchableOpacity>
          <Text style={styles.supportEmail}>{SUPPORT_EMAIL}</Text>
        </View>

        {/* Version Info */}
        <View style={styles.versionInfo}>
          <Text style={styles.versionText}>RouteCast v1.0</Text>
          <Text style={styles.versionSubtext}>Weather-smart route planning for everyone</Text>
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
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eab30830',
  },
  welcomeTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
  },
  welcomeSubtitle: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  quickTips: {
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  quickTipsTitle: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  tipRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  tipItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#27272a',
    borderRadius: 8,
    padding: 10,
  },
  tipText: {
    color: '#d4d4d8',
    fontSize: 12,
    flex: 1,
  },
  sectionHeader: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 8,
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
  },
  stepsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#27272a',
  },
  stepItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '700',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  stepDesc: {
    color: '#a1a1aa',
    fontSize: 13,
    lineHeight: 19,
  },
  stepTips: {
    marginTop: 8,
    backgroundColor: '#1c1917',
    borderRadius: 8,
    padding: 10,
  },
  stepTipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 4,
  },
  stepTipText: {
    color: '#fde68a',
    fontSize: 12,
    flex: 1,
  },
  faqContainer: {
    marginBottom: 20,
  },
  faqItem: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#27272a',
    overflow: 'hidden',
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  faqQuestionText: {
    color: '#e4e4e7',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  faqAnswer: {
    backgroundColor: '#111',
    padding: 14,
    paddingTop: 0,
  },
  faqAnswerText: {
    color: '#9ca3af',
    fontSize: 13,
    lineHeight: 20,
  },
  supportCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#8b5cf620',
  },
  supportIconRow: {
    marginBottom: 12,
  },
  supportIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#8b5cf620',
    justifyContent: 'center',
    alignItems: 'center',
  },
  supportTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  supportText: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8b5cf6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    gap: 8,
  },
  supportButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  supportEmail: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 12,
  },
  versionInfo: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  versionText: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '600',
  },
  versionSubtext: {
    color: '#52525b',
    fontSize: 12,
    marginTop: 4,
  },
});
