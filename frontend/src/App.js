import React from 'react';

function App() {
  return (
    <div className="app">
      <header className="header">
        <div className="logo-row">
          <div className="logo-icon" style={{ background: '#eab30820' }}>☀️</div>
          <div className="logo-icon" style={{ background: '#3b82f620' }}>🗺️</div>
          <div className="logo-icon" style={{ background: '#22c55e20' }}>✅</div>
        </div>
        <h1 className="app-title">RouteCast</h1>
        <p className="app-subtitle">Weather-smart route planning for RVers, truckers, and travelers</p>
      </header>

      <main className="main-content">
        {/* Weather Features */}
        <h2 className="section-title">🌦️ Weather Along Route</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-header">
              <div className="feature-icon" style={{ background: '#eab30820' }}>⏰</div>
              <h3 className="feature-title">Hourly Forecasts</h3>
            </div>
            <p className="feature-desc">View hour-by-hour weather for each waypoint along your route.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-header">
              <div className="feature-icon" style={{ background: '#ef444420' }}>⚠️</div>
              <h3 className="feature-title">Weather Alerts</h3>
            </div>
            <p className="feature-desc">Active NWS alerts along your route. Up to 10 alerts from the last 2 hours.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-header">
              <div className="feature-icon" style={{ background: '#3b82f620' }}>🗺️</div>
              <h3 className="feature-title">Weather Radar Map</h3>
            </div>
            <p className="feature-desc">Live precipitation radar overlay on your route map.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-header">
              <div className="feature-icon" style={{ background: '#06b6d420' }}>🚗</div>
              <h3 className="feature-title">Road Conditions</h3>
            </div>
            <p className="feature-desc">Ice risk, wet roads, and visibility warnings based on weather.</p>
          </div>
        </div>

        {/* Smart Features */}
        <h2 className="section-title">💡 Smart Travel Features</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-header">
              <div className="feature-icon" style={{ background: '#8b5cf620' }}>⏱️</div>
              <h3 className="feature-title">Leave Later / Smart Delay</h3>
            </div>
            <p className="feature-desc">Get recommendations on the best departure time based on weather conditions.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-header">
              <div className="feature-icon" style={{ background: '#22c55e20' }}>🔊</div>
              <h3 className="feature-title">Route to Speech</h3>
            </div>
            <p className="feature-desc">Listen to your route weather summary hands-free.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-header">
              <div className="feature-icon" style={{ background: '#ef444420' }}>🔔</div>
              <h3 className="feature-title">Push Notifications</h3>
            </div>
            <p className="feature-desc">Receive alerts when weather conditions change significantly.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-header">
              <div className="feature-icon" style={{ background: '#06b6d420' }}>💬</div>
              <h3 className="feature-title">AI Chat Assistant</h3>
            </div>
            <p className="feature-desc">Ask questions about your route or get travel recommendations.</p>
          </div>
        </div>

        {/* Boondockers */}
        <h2 className="section-title">🏕️ Boondockers Features</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-header">
              <div className="feature-icon" style={{ background: '#8b451320' }}>🔥</div>
              <h3 className="feature-title">Boondockers Toolkit</h3>
            </div>
            <p className="feature-desc">Complete toolkit for off-grid camping and RV living.</p>
            <ul className="feature-list">
              <li>🏕️ Free Camping Finder</li>
              <li>🚿 Dump Station Finder</li>
              <li>🏪 Last Chance Supplies</li>
              <li>🚐 RV Dealerships</li>
              <li>☀️ Solar Forecast</li>
              <li>🔥 Propane Calculator</li>
              <li>💧 Water Budget Planner</li>
              <li>🌬️ Wind Shelter Advisor</li>
              <li>📶 Connectivity Checker</li>
              <li>📊 Campsite Index</li>
              <li>✅ Camp Prep Checklist</li>
            </ul>
          </div>
        </div>

        {/* Tractor Trailer */}
        <h2 className="section-title">🚛 Tractor Trailer Features</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-header">
              <div className="feature-icon" style={{ background: '#3b82f620' }}>🚛</div>
              <h3 className="feature-title">Trucker Toolkit</h3>
            </div>
            <p className="feature-desc">Professional tools designed for commercial truck drivers.</p>
            <ul className="feature-list">
              <li>⛽ Truck Stops & Fuel</li>
              <li>⚖️ Weigh Stations</li>
              <li>🅿️ Truck Parking</li>
              <li>🚧 Low Clearance Alerts</li>
              <li>🔧 Truck Services</li>
              <li>🚫 Truck Restrictions</li>
            </ul>
          </div>
        </div>

        {/* Safety Alerts */}
        <h2 className="section-title">🛡️ Hazards & Safety Alerts</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-header">
              <div className="feature-icon" style={{ background: '#ef444420' }}>🌉</div>
              <h3 className="feature-title">Bridge Height Alerts</h3>
            </div>
            <p className="feature-desc">Warnings for low clearance bridges. Essential for RVs and trucks.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-header">
              <div className="feature-icon" style={{ background: '#06b6d420' }}>💨</div>
              <h3 className="feature-title">Wind Warnings</h3>
            </div>
            <p className="feature-desc">High wind alerts for high-profile vehicles (25mph+ sustained).</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-header">
              <div className="feature-icon" style={{ background: '#8b5cf620' }}>🌫️</div>
              <h3 className="feature-title">Visibility Warnings</h3>
            </div>
            <p className="feature-desc">Alerts for fog, heavy rain, snow, or dust reducing visibility.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-header">
              <div className="feature-icon" style={{ background: '#22c55e20' }}>❄️</div>
              <h3 className="feature-title">Ice & Snow Alerts</h3>
            </div>
            <p className="feature-desc">Warnings when temperatures are near freezing with precipitation.</p>
          </div>
        </div>

        {/* Pricing */}
        <div className="pricing-section">
          <h2 className="pricing-title">💎 Subscription Plans</h2>
          <p className="pricing-trial">🎁 Start with a FREE 1-week trial</p>
          
          <div className="pricing-cards">
            <div className="pricing-card">
              <div className="pricing-amount">$9.99</div>
              <div className="pricing-period">per month</div>
              <div className="pricing-note">Billed monthly</div>
            </div>
            
            <div className="pricing-card best">
              <div className="save-badge">SAVE 50%</div>
              <div className="pricing-amount">$59.99</div>
              <div className="pricing-period">per year</div>
              <div className="pricing-note">Just $5/month</div>
            </div>
          </div>
          
          <p className="pricing-footer">All features included • Cancel anytime • Managed by Google Play</p>
        </div>

        {/* Important Notes */}
        <div className="notes-section">
          <h3 className="notes-title">ℹ️ Important Notes</h3>
          <ul className="notes-list">
            <li>• Weather alerts are capped at 10 alerts from the last 2 hours along your route</li>
            <li>• Location services must be enabled for auto-detect features</li>
            <li>• Push notifications require a one-time permission grant</li>
            <li>• All features included with your subscription - no paywalls</li>
          </ul>
        </div>
      </main>

      <footer className="footer">
        <p>RouteCast © 2026 • Weather-smart route planning</p>
        <p style={{ marginTop: '8px' }}>Available on Google Play Store</p>
      </footer>
    </div>
  );
}

export default App;
