# RouteCast - Product Requirements Document

## Overview
RouteCast is a React Native/Expo mobile app providing weather-smart route planning for road trips, RVers, and truck drivers. The app integrates real-time weather data (NOAA), location search (Mapbox), and point-of-interest data (Google Places API).

## Tech Stack
- **Frontend**: React Native, Expo SDK 51, TypeScript, Expo Router
- **Backend**: Python FastAPI
- **Database**: MongoDB
- **APIs**: NOAA Weather Service, Mapbox Geocoding, Google Places API

## Core Features

### Route Weather
- Enter origin and destination addresses with autocomplete
- View weather conditions along entire route
- Safety score calculation based on conditions
- Weather alerts from NWS
- Turn-by-turn directions

### Boondockers Section
- Camp Prep Checklist (persistent)
- Free Camping Finder
- Casinos Near Me (with address search)
- Walmart Overnight Parking
- Cracker Barrel locations
- Dump Station Finder
- Last Chance Supplies (groceries)
- RV Dealerships
- Solar Forecast calculator
- Propane Usage calculator
- Water Budget Planner (Fresh/Gray/Black tanks)
- Wind Shelter recommendations
- Connectivity Check
- Campsite Suitability Index

### Truck Drivers Section
- Truck Stops and Fuel
- Weigh Stations
- Truck Parking
- Truck Repair Services
- Low Bridge Clearance Alerts (via Trucker Mode)
- Weight Restricted Routes info

### User Experience
- Clear X buttons on address inputs
- Comprehensive How To Use guide
- AI Chat Assistant
- Push Weather Alerts
- Favorites and Recent routes

## Implemented Features (as of Dec 2025)

### Completed This Session
1. **Water Budget with 3 Tanks** - Fresh, Gray, Black water tanks with usage calculations
2. **Casinos Fix** - Improved UX when location unavailable, shows prompt to search
3. **Bridge Height Hazards Tab** - Added to route page for trucker alerts
4. **Clear X Buttons** - On origin/destination inputs for quick clearing
5. **How To Use Page** - Comprehensive guide with step-by-step instructions
6. **Support Email** - support@routecast.com integrated in How To Use

### Previous Implementation
- All Boondocker/Trucker API endpoints (Google Places)
- Address search with autocomplete on all feature screens
- Trucker Mode with vehicle height input
- Backend route weather calculation

## Known Limitations
- **Bridge Clearance Alerts**: Currently returns empty (no real bridge database integrated)
- **Weight Restrictions**: Returns general federal limits only, not location-specific
- **Location Detection**: May fail in web preview, use address search as fallback

## Environment Variables
- `MAPBOX_ACCESS_TOKEN` - For geocoding
- `GOOGLE_API_KEY` - For Places API
- `MONGO_URL` - Database connection

## API Endpoints

### Core
- `POST /api/route/weather` - Get route weather forecast
- `GET /api/geocode/autocomplete` - Address suggestions
- `GET /api/geocode/reverse` - Coordinates to address

### Boondocking
- `GET /api/boondocking/casinos` - Find casinos
- `GET /api/boondocking/places` - Generic POI search
- `POST /api/water-budget` - Water tank calculations
- `POST /api/boondocking/solar-forecast` - Solar calculations
- `POST /api/boondocking/propane-usage` - Propane calculations

### Trucker
- `GET /api/trucker/truck-stops` - Find truck stops
- `GET /api/trucker/repair-services` - Find repair shops
- `GET /api/trucker/weight-restrictions` - Weight limit info

## Pending Tasks

### P0 (Critical)
- Implement real bridge clearance data source

### P1 (High Priority)
- Verify all Boondocker/Trucker features with user
- Add screenshots to User Guide

### P2 (Medium Priority)
- Holistic UI/appearance improvement
- Refactor server.py into modular routers
- Extract reusable location search component

### P3 (Low Priority)
- Location-specific weight restriction data
- Offline mode support
