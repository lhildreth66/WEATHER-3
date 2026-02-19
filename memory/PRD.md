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
- Clear X buttons to quickly clear address inputs
- View weather conditions along entire route
- Safety score calculation based on conditions
- Weather alerts from NWS
- Turn-by-turn directions
- Voice "Listen" button for road conditions (hands-free)

### Boondockers Section
- Camp Prep Checklist (persistent)
- Free Camping Finder
- Casinos Near Me (with address search + location detect)
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
- Truck Stops and Fuel (with location detect)
- Weigh Stations
- Truck Parking (with location detect)
- Truck Repair Services (with location detect)
- Low Bridge Clearance Alerts (via Trucker Mode)
- Weight Restricted Routes info
- Bridge Height Hazards tab on route page

### User Experience
- Clear X buttons on address inputs
- Location detect button on all POI screens
- Comprehensive How To Use guide
- Push Weather Alerts (via external worker)
- Favorites and Recent routes
- NO AI chat bubble (removed per user request)
- Voice alerts for road conditions only (hands-free)

## Implemented Features (as of Dec 2025)

### Completed This Session
1. **AI Chat Bubble Removed** - Removed from both home and route pages
2. **Truck Services Fixed** - Added address search + location detect button
3. **Truck Stops Fixed** - Added address search + location detect button  
4. **Truck Parking Fixed** - Added address search + location detect button
5. **Water Budget with 3 Tanks** - Fresh, Gray, Black water tanks
6. **Bridge Height Hazards Tab** - Added to route page
7. **Clear X Buttons** - On origin/destination inputs
8. **How To Use Page** - Comprehensive guide with support email

### Previous Implementation
- All Boondocker/Trucker API endpoints (Google Places)
- Address search with autocomplete on all feature screens
- Trucker Mode with vehicle height input
- Backend route weather calculation

## Known Limitations
- **Bridge Clearance Alerts**: Currently returns empty (no real bridge database integrated yet)
- **Weight Restrictions**: Returns general federal limits only
- **Location Detection**: May fail in web preview, use address search as fallback

## Push Notifications
Push notifications are handled by an **external worker** deployed on Render.com:
- Worker files: `backend/route_alerts.py`, `backend/run_route_alerts_worker.py`
- Runs every ~70 minutes via cron
- Also triggered on-demand when user saves/starts monitoring a route
- Uses Firebase/Expo for push delivery
- MongoDB stores route monitors and push tokens

## Environment Variables
- `MAPBOX_ACCESS_TOKEN` - For geocoding
- `GOOGLE_API_KEY` - For Places API
- `MONGO_URL` - Database connection

## Pending Tasks

### P0 (Critical)
- Integrate real bridge clearance data (OSM Overpass API as fallback, LCM API for production)

### P1 (High Priority)
- User requested preview URL permanence (need production deployment)
- Verify all location-based features work properly

### P2 (Medium Priority)
- Holistic UI/appearance improvement
- Refactor server.py into modular routers
- Add screenshots to User Guide

### P3 (Low Priority)
- Location-specific weight restriction data
- Offline mode support
