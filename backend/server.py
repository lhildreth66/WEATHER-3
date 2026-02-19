from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import httpx
import polyline
import asyncio
import math
import google.generativeai as genai

# Import bridge height service
from services.bridge_height_service import get_bridge_clearances_for_route

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# API Keys
MAPBOX_ACCESS_TOKEN = os.environ.get('MAPBOX_ACCESS_TOKEN', '')
GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY', '')

# Configure Google Gemini
if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)

# NOAA API Headers
NOAA_USER_AGENT = os.environ.get('NOAA_USER_AGENT', 'Routecast/1.0 (contact@routecast.app)')
NOAA_HEADERS = {
    'User-Agent': NOAA_USER_AGENT,
    'Accept': 'application/geo+json'
}

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== Models ====================

# Vehicle types for safety scoring
VEHICLE_TYPES = {
    "car": {"wind_sensitivity": 1.0, "ice_sensitivity": 1.0, "visibility_sensitivity": 1.0, "name": "Car/Sedan"},
    "suv": {"wind_sensitivity": 1.1, "ice_sensitivity": 0.9, "visibility_sensitivity": 1.0, "name": "SUV"},
    "truck": {"wind_sensitivity": 1.3, "ice_sensitivity": 0.85, "visibility_sensitivity": 1.0, "name": "Pickup Truck"},
    "semi": {"wind_sensitivity": 1.8, "ice_sensitivity": 1.2, "visibility_sensitivity": 1.3, "name": "Semi Truck"},
    "rv": {"wind_sensitivity": 1.7, "ice_sensitivity": 1.1, "visibility_sensitivity": 1.2, "name": "RV/Motorhome"},
    "motorcycle": {"wind_sensitivity": 2.0, "ice_sensitivity": 2.5, "visibility_sensitivity": 1.5, "name": "Motorcycle"},
    "trailer": {"wind_sensitivity": 1.6, "ice_sensitivity": 1.3, "visibility_sensitivity": 1.1, "name": "Vehicle + Trailer"},
}

# Road condition types
ROAD_CONDITIONS = {
    "dry": {"severity": 0, "color": "#22c55e", "icon": "✓", "label": "DRY"},
    "wet": {"severity": 1, "color": "#3b82f6", "icon": "💧", "label": "WET"},
    "slippery": {"severity": 2, "color": "#f59e0b", "icon": "⚠️", "label": "SLIPPERY"},
    "icy": {"severity": 3, "color": "#ef4444", "icon": "🧊", "label": "ICY"},
    "snow_covered": {"severity": 3, "color": "#93c5fd", "icon": "❄️", "label": "SNOW"},
    "flooded": {"severity": 4, "color": "#dc2626", "icon": "🌊", "label": "FLOODING"},
    "low_visibility": {"severity": 2, "color": "#9ca3af", "icon": "🌫️", "label": "LOW VIS"},
    "dangerous_wind": {"severity": 3, "color": "#8b5cf6", "icon": "💨", "label": "HIGH WIND"},
}

class StopPoint(BaseModel):
    location: str
    type: str = "stop"  # stop, gas, food, rest

class RoadCondition(BaseModel):
    condition: str  # dry, wet, icy, snow_covered, flooded, low_visibility, dangerous_wind
    severity: int  # 0-4 (0=good, 4=dangerous)
    label: str
    icon: str
    color: str
    description: str
    recommendation: str

class TurnByTurnStep(BaseModel):
    instruction: str
    distance_miles: float
    duration_minutes: int
    road_name: str
    maneuver: str  # turn-left, turn-right, merge, etc.
    road_condition: Optional[RoadCondition] = None
    weather_at_step: Optional[str] = None
    temperature: Optional[int] = None
    has_alert: bool = False

class AlternateRoute(BaseModel):
    name: str
    distance_miles: float
    duration_minutes: int
    road_condition_summary: str
    safety_score: int
    recommendation: str
    avoids: List[str]  # What hazards this route avoids

class RouteRequest(BaseModel):
    origin: str
    destination: str
    departure_time: Optional[str] = None  # ISO format datetime
    stops: Optional[List[StopPoint]] = []
    vehicle_type: Optional[str] = "car"  # car, suv, truck, semi, rv, motorcycle, trailer
    trucker_mode: Optional[bool] = False  # Enable trucker-specific warnings
    vehicle_height_ft: Optional[float] = None  # Vehicle height in feet for clearance warnings

class HazardAlert(BaseModel):
    type: str  # wind, ice, visibility, rain, snow, etc.
    severity: str  # low, medium, high, extreme
    distance_miles: float
    eta_minutes: int
    message: str
    recommendation: str
    countdown_text: str  # "Heavy rain in 27 minutes"

class RestStop(BaseModel):
    name: str
    type: str  # gas, food, rest_area
    lat: float
    lon: float
    distance_miles: float
    eta_minutes: int
    weather_at_arrival: Optional[str] = None
    temperature_at_arrival: Optional[int] = None
    recommendation: str  # "Good time to stop - rain clears"

class DepartureWindow(BaseModel):
    departure_time: str
    arrival_time: str
    safety_score: int
    hazard_count: int
    recommendation: str
    conditions_summary: str

class SafetyScore(BaseModel):
    overall_score: int  # 0-100
    risk_level: str  # low, moderate, high, extreme
    vehicle_type: str
    factors: List[str]  # List of contributing factors
    recommendations: List[str]

class ChatMessage(BaseModel):
    message: str
    route_context: Optional[str] = None  # Optional route info for context

class ChatResponse(BaseModel):
    response: str
    suggestions: List[str] = []

class PushTokenRequest(BaseModel):
    token: str
    platform: str  # ios, android, web
    userId: Optional[str] = "anonymous"
    timestamp: Optional[str] = None

class PushTokenResponse(BaseModel):
    success: bool
    message: str

class Waypoint(BaseModel):
    lat: float
    lon: float
    name: Optional[str] = None
    distance_from_start: Optional[float] = None  # in miles
    eta_minutes: Optional[int] = None  # minutes from departure
    arrival_time: Optional[str] = None  # ISO format

class HourlyForecast(BaseModel):
    time: str
    temperature: int
    conditions: str
    wind_speed: str
    precipitation_chance: Optional[int] = None

class WeatherData(BaseModel):
    temperature: Optional[int] = None
    temperature_unit: Optional[str] = "F"
    wind_speed: Optional[str] = None
    wind_direction: Optional[str] = None
    conditions: Optional[str] = None
    icon: Optional[str] = None
    humidity: Optional[int] = None
    is_daytime: Optional[bool] = True
    sunrise: Optional[str] = None
    sunset: Optional[str] = None
    hourly_forecast: Optional[List[HourlyForecast]] = []

class WeatherAlert(BaseModel):
    id: str
    headline: str
    severity: str
    event: str
    description: str
    areas: Optional[str] = None

class PackingSuggestion(BaseModel):
    item: str
    reason: str
    priority: str  # essential, recommended, optional

class WaypointWeather(BaseModel):
    waypoint: Waypoint
    weather: Optional[WeatherData] = None
    alerts: List[WeatherAlert] = []
    error: Optional[str] = None

class BridgeClearanceAlert(BaseModel):
    location: str
    latitude: float
    longitude: float
    clearance_ft: float
    vehicle_height_ft: float
    margin_ft: float
    warning_level: str  # safe, caution, danger
    distance_miles: float
    highway: Optional[str] = None
    direction: Optional[str] = None
    message: str

class RouteWeatherResponse(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    origin: str
    destination: str
    stops: List[StopPoint] = []
    departure_time: Optional[str] = None
    total_duration_minutes: Optional[int] = None
    total_distance_miles: Optional[float] = None
    route_geometry: str  # Encoded polyline
    waypoints: List[WaypointWeather]
    ai_summary: Optional[str] = None
    has_severe_weather: bool = False
    packing_suggestions: List[PackingSuggestion] = []
    weather_timeline: List[HourlyForecast] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_favorite: bool = False
    # New fields for enhanced features
    safety_score: Optional[SafetyScore] = None
    hazard_alerts: List[HazardAlert] = []
    rest_stops: List[RestStop] = []
    optimal_departure: Optional[DepartureWindow] = None
    trucker_warnings: List[str] = []
    vehicle_type: str = "car"
    vehicle_height_ft: Optional[float] = None
    bridge_clearance_alerts: List[BridgeClearanceAlert] = []
    # Road conditions and navigation
    turn_by_turn: List[TurnByTurnStep] = []
    road_condition_summary: Optional[str] = None
    worst_road_condition: Optional[str] = None
    alternate_routes: List[AlternateRoute] = []
    reroute_recommended: bool = False
    reroute_reason: Optional[str] = None

class SavedRoute(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    origin: str
    destination: str
    stops: List[StopPoint] = []
    is_favorite: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

class FavoriteRouteRequest(BaseModel):
    origin: str
    destination: str
    stops: Optional[List[StopPoint]] = []
    name: Optional[str] = None

# ==================== Helper Functions ====================

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in miles."""
    R = 3959  # Earth's radius in miles
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

def calculate_eta(distance_miles: float, avg_speed_mph: float = 55) -> int:
    """Calculate ETA in minutes."""
    return int((distance_miles / avg_speed_mph) * 60)

def extract_waypoints_from_route(encoded_polyline: str, interval_miles: float = 50, departure_time: Optional[datetime] = None) -> List[Waypoint]:
    """Extract waypoints along route at specified intervals with ETAs."""
    try:
        coords = polyline.decode(encoded_polyline)
        if not coords:
            return []
        
        waypoints = []
        total_distance = 0.0
        last_waypoint_distance = 0.0
        
        dep_time = departure_time or datetime.now()
        
        # Always include start point
        waypoints.append(Waypoint(
            lat=coords[0][0],
            lon=coords[0][1],
            name="Start",
            distance_from_start=0,
            eta_minutes=0,
            arrival_time=dep_time.isoformat()
        ))
        
        for i in range(1, len(coords)):
            lat1, lon1 = coords[i-1]
            lat2, lon2 = coords[i]
            segment_distance = haversine_distance(lat1, lon1, lat2, lon2)
            total_distance += segment_distance
            
            # Add waypoint if we've traveled enough distance
            if total_distance - last_waypoint_distance >= interval_miles:
                eta_mins = calculate_eta(total_distance)
                arrival = dep_time + timedelta(minutes=eta_mins)
                waypoints.append(Waypoint(
                    lat=lat2,
                    lon=lon2,
                    name=f"Mile {int(total_distance)}",
                    distance_from_start=round(total_distance, 1),
                    eta_minutes=eta_mins,
                    arrival_time=arrival.isoformat()
                ))
                last_waypoint_distance = total_distance
        
        # Always include end point
        end_lat, end_lon = coords[-1]
        if len(waypoints) == 1 or haversine_distance(
            waypoints[-1].lat, waypoints[-1].lon, end_lat, end_lon
        ) > 10:
            eta_mins = calculate_eta(total_distance)
            arrival = dep_time + timedelta(minutes=eta_mins)
            waypoints.append(Waypoint(
                lat=end_lat,
                lon=end_lon,
                name="Destination",
                distance_from_start=round(total_distance, 1),
                eta_minutes=eta_mins,
                arrival_time=arrival.isoformat()
            ))
        
        return waypoints
    except Exception as e:
        logger.error(f"Error extracting waypoints: {e}")
        return []

async def reverse_geocode(lat: float, lon: float) -> Optional[str]:
    """Reverse geocode coordinates to get city, state name."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{lon},{lat}.json"
            params = {
                'access_token': MAPBOX_ACCESS_TOKEN,
                'types': 'place,locality',
                'limit': 1
            }
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            if data.get('features') and len(data['features']) > 0:
                feature = data['features'][0]
                place_name = feature.get('text', '')
                
                # Extract state from context
                context = feature.get('context', [])
                state = ''
                for ctx in context:
                    if ctx.get('id', '').startswith('region'):
                        state = ctx.get('short_code', '').replace('US-', '')
                        break
                
                if place_name and state:
                    return f"{place_name}, {state}"
                return place_name or None
    except Exception as e:
        logger.error(f"Reverse geocoding error for {lat},{lon}: {e}")
    return None

async def geocode_location(location: str) -> Optional[Dict[str, float]]:
    """Geocode a location string to coordinates using Mapbox."""
    try:
        async with httpx.AsyncClient() as client:
            url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{location}.json"
            params = {
                'access_token': MAPBOX_ACCESS_TOKEN,
                'limit': 1,
                'country': 'US'
            }
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            if data.get('features') and len(data['features']) > 0:
                coords = data['features'][0]['center']
                return {'lon': coords[0], 'lat': coords[1]}
    except Exception as e:
        logger.error(f"Geocoding error for {location}: {e}")
    return None

async def get_mapbox_route(origin_coords: Dict, dest_coords: Dict, waypoints: List[Dict] = None) -> Optional[Dict]:
    """Get route from Mapbox Directions API with duration."""
    try:
        # Build coordinates string
        coords_list = [f"{origin_coords['lon']},{origin_coords['lat']}"]
        if waypoints:
            for wp in waypoints:
                coords_list.append(f"{wp['lon']},{wp['lat']}")
        coords_list.append(f"{dest_coords['lon']},{dest_coords['lat']}")
        coords_str = ";".join(coords_list)
        
        async with httpx.AsyncClient() as client:
            url = f"https://api.mapbox.com/directions/v5/mapbox/driving/{coords_str}"
            params = {
                'access_token': MAPBOX_ACCESS_TOKEN,
                'geometries': 'polyline',
                'overview': 'full'
            }
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            # Check for "no route" response
            if data.get('code') == 'NoRoute':
                logger.warning(f"No drivable route found between coordinates")
                return None
            
            if data.get('routes') and len(data['routes']) > 0:
                route = data['routes'][0]
                return {
                    'geometry': route['geometry'],
                    'duration': route.get('duration', 0) / 60,  # Convert to minutes
                    'distance': route.get('distance', 0) / 1609.34  # Convert to miles
                }
            else:
                logger.warning(f"No routes in Mapbox response: {data.get('code', 'unknown')}")
    except Exception as e:
        logger.error(f"Mapbox route error: {e}")
    return None

async def get_noaa_weather(lat: float, lon: float) -> Optional[WeatherData]:
    """Get weather data from NOAA for a location with sunrise/sunset."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # First get the grid point
            point_url = f"https://api.weather.gov/points/{lat:.4f},{lon:.4f}"
            point_response = await client.get(point_url, headers=NOAA_HEADERS)
            
            if point_response.status_code != 200:
                logger.warning(f"NOAA points API error for {lat},{lon}: {point_response.status_code}")
                return None
            
            point_data = point_response.json()
            props = point_data.get('properties', {})
            forecast_url = props.get('forecastHourly')
            
            if not forecast_url:
                return None
            
            # Get hourly forecast
            forecast_response = await client.get(forecast_url, headers=NOAA_HEADERS)
            
            if forecast_response.status_code != 200:
                logger.warning(f"NOAA forecast API error: {forecast_response.status_code}")
                return None
            
            forecast_data = forecast_response.json()
            periods = forecast_data.get('properties', {}).get('periods', [])
            
            # Get hourly forecasts for timeline
            hourly_forecast = []
            for period in periods[:12]:  # Next 12 hours
                hourly_forecast.append(HourlyForecast(
                    time=period.get('startTime', ''),
                    temperature=period.get('temperature', 0),
                    conditions=period.get('shortForecast', ''),
                    wind_speed=period.get('windSpeed', ''),
                    precipitation_chance=period.get('probabilityOfPrecipitation', {}).get('value')
                ))
            
            if periods:
                current = periods[0]
                
                # Calculate approximate sunrise/sunset based on time of day
                # This is simplified - in production, use a proper sun calculation library
                is_daytime = current.get('isDaytime', True)
                now = datetime.now()
                sunrise = now.replace(hour=6, minute=30).strftime("%I:%M %p")
                sunset = now.replace(hour=18, minute=30).strftime("%I:%M %p")
                
                return WeatherData(
                    temperature=current.get('temperature'),
                    temperature_unit=current.get('temperatureUnit', 'F'),
                    wind_speed=current.get('windSpeed'),
                    wind_direction=current.get('windDirection'),
                    conditions=current.get('shortForecast'),
                    icon=current.get('icon'),
                    humidity=current.get('relativeHumidity', {}).get('value'),
                    is_daytime=is_daytime,
                    sunrise=sunrise,
                    sunset=sunset,
                    hourly_forecast=hourly_forecast
                )
    except Exception as e:
        logger.error(f"NOAA weather error for {lat},{lon}: {e}")
    return None

async def get_noaa_alerts(lat: float, lon: float) -> List[WeatherAlert]:
    """Get weather alerts from NOAA for a location."""
    alerts = []
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            url = f"https://api.weather.gov/alerts?point={lat:.4f},{lon:.4f}"
            response = await client.get(url, headers=NOAA_HEADERS)
            
            if response.status_code == 200:
                data = response.json()
                features = data.get('features', [])
                
                for feature in features[:5]:  # Limit to 5 alerts
                    props = feature.get('properties', {})
                    alerts.append(WeatherAlert(
                        id=props.get('id', str(uuid.uuid4())),
                        headline=props.get('headline', 'Weather Alert'),
                        severity=props.get('severity', 'Unknown'),
                        event=props.get('event', 'Weather Event'),
                        description=props.get('description', '')[:500],
                        areas=props.get('areaDesc')
                    ))
    except Exception as e:
        logger.error(f"NOAA alerts error for {lat},{lon}: {e}")
    return alerts

def generate_packing_suggestions(waypoints_weather: List[WaypointWeather]) -> List[PackingSuggestion]:
    """Generate packing suggestions based on weather conditions."""
    suggestions = []
    
    temps = []
    has_rain = False
    has_snow = False
    has_wind = False
    has_sun = False
    
    for wp in waypoints_weather:
        if wp.weather:
            if wp.weather.temperature:
                temps.append(wp.weather.temperature)
            
            conditions = (wp.weather.conditions or '').lower()
            if 'rain' in conditions or 'shower' in conditions:
                has_rain = True
            if 'snow' in conditions or 'flurr' in conditions:
                has_snow = True
            if 'wind' in conditions:
                has_wind = True
            if 'sun' in conditions or 'clear' in conditions:
                has_sun = True
            
            # Check wind speed
            wind = wp.weather.wind_speed or ''
            if any(str(x) in wind for x in range(15, 50)):
                has_wind = True
    
    # Temperature-based suggestions
    if temps:
        min_temp = min(temps)
        max_temp = max(temps)
        
        if min_temp < 40:
            suggestions.append(PackingSuggestion(
                item="Warm jacket",
                reason=f"Temperatures as low as {min_temp}°F expected",
                priority="essential"
            ))
        if min_temp < 32:
            suggestions.append(PackingSuggestion(
                item="Gloves & hat",
                reason="Freezing temperatures along route",
                priority="essential"
            ))
        if max_temp > 85:
            suggestions.append(PackingSuggestion(
                item="Extra water",
                reason=f"High temperatures up to {max_temp}°F",
                priority="essential"
            ))
        if max_temp - min_temp > 20:
            suggestions.append(PackingSuggestion(
                item="Layers",
                reason=f"Temperature range of {max_temp - min_temp}°F",
                priority="recommended"
            ))
    
    # Condition-based suggestions
    if has_rain:
        suggestions.append(PackingSuggestion(
            item="Umbrella/rain jacket",
            reason="Rain expected along route",
            priority="essential"
        ))
    if has_snow:
        suggestions.append(PackingSuggestion(
            item="Snow gear & emergency kit",
            reason="Snow conditions expected",
            priority="essential"
        ))
    if has_wind:
        suggestions.append(PackingSuggestion(
            item="Windbreaker",
            reason="Windy conditions expected",
            priority="recommended"
        ))
    if has_sun:
        suggestions.append(PackingSuggestion(
            item="Sunglasses",
            reason="Sunny conditions expected",
            priority="recommended"
        ))
        suggestions.append(PackingSuggestion(
            item="Sunscreen",
            reason="Sun exposure during drive",
            priority="optional"
        ))
    
    # Always recommend
    suggestions.append(PackingSuggestion(
        item="Phone charger",
        reason="Keep devices charged for navigation",
        priority="essential"
    ))
    suggestions.append(PackingSuggestion(
        item="Snacks & water",
        reason="Stay hydrated and energized",
        priority="recommended"
    ))
    
    return suggestions[:8]  # Limit to 8 suggestions

def build_weather_timeline(waypoints_weather: List[WaypointWeather]) -> List[HourlyForecast]:
    """Build a combined weather timeline from all waypoints."""
    timeline = []
    seen_times = set()
    
    for wp in waypoints_weather:
        if wp.weather and wp.weather.hourly_forecast:
            for forecast in wp.weather.hourly_forecast[:4]:  # First 4 hours from each
                if forecast.time not in seen_times:
                    timeline.append(forecast)
                    seen_times.add(forecast.time)
    
    # Sort by time
    timeline.sort(key=lambda x: x.time)
    return timeline[:12]  # Return up to 12 hours

def calculate_safety_score(waypoints_weather: List[WaypointWeather], vehicle_type: str = "car") -> SafetyScore:
    """Calculate safety score based on weather conditions and vehicle type."""
    vehicle = VEHICLE_TYPES.get(vehicle_type, VEHICLE_TYPES["car"])
    
    base_score = 100
    factors = []
    recommendations = []
    
    for wp in waypoints_weather:
        if not wp.weather:
            continue
            
        # Temperature risks
        temp = wp.weather.temperature or 70
        if temp < 32:
            penalty = 15 * vehicle["ice_sensitivity"]
            base_score -= penalty
            if "Freezing temperatures - ice risk" not in factors:
                factors.append("Freezing temperatures - ice risk")
                recommendations.append("Reduce speed on bridges and overpasses")
        elif temp < 40:
            base_score -= 5 * vehicle["ice_sensitivity"]
            
        # Wind risks
        wind_str = wp.weather.wind_speed or "0 mph"
        try:
            wind_speed = int(''.join(filter(str.isdigit, wind_str.split()[0])))
        except:
            wind_speed = 0
            
        if wind_speed > 30:
            penalty = 20 * vehicle["wind_sensitivity"]
            base_score -= penalty
            if "High winds" not in factors:
                factors.append("High winds")
                if vehicle_type in ["semi", "rv", "trailer", "motorcycle"]:
                    recommendations.append("Consider delaying trip - dangerous wind conditions for your vehicle")
                else:
                    recommendations.append("Maintain firm grip on steering wheel")
        elif wind_speed > 20:
            base_score -= 8 * vehicle["wind_sensitivity"]
            
        # Visibility/condition risks
        conditions = (wp.weather.conditions or "").lower()
        if "snow" in conditions or "blizzard" in conditions:
            penalty = 25 * vehicle["visibility_sensitivity"]
            base_score -= penalty
            if "Snow/winter conditions" not in factors:
                factors.append("Snow/winter conditions")
                recommendations.append("Use winter driving mode, increase following distance")
        elif "rain" in conditions or "storm" in conditions:
            penalty = 15 * vehicle["visibility_sensitivity"]
            base_score -= penalty
            if "Rain/storm conditions" not in factors:
                factors.append("Rain/storm conditions")
                recommendations.append("Turn on headlights, reduce speed")
        elif "fog" in conditions:
            penalty = 20 * vehicle["visibility_sensitivity"]
            base_score -= penalty
            if "Low visibility - fog" not in factors:
                factors.append("Low visibility - fog")
                recommendations.append("Use low beam headlights, avoid sudden stops")
                
        # Alerts
        for alert in wp.alerts:
            if alert.severity in ["Extreme", "Severe"]:
                base_score -= 20
                if alert.event not in factors:
                    factors.append(f"Weather alert: {alert.event}")
    
    # Clamp score
    final_score = max(0, min(100, int(base_score)))
    
    # Determine risk level
    if final_score >= 80:
        risk_level = "low"
    elif final_score >= 60:
        risk_level = "moderate"
    elif final_score >= 40:
        risk_level = "high"
    else:
        risk_level = "extreme"
        recommendations.insert(0, "⚠️ Consider postponing trip if possible")
    
    if not factors:
        factors.append("Good driving conditions")
    if not recommendations:
        recommendations.append("Safe travels! Normal driving conditions expected")
        
    return SafetyScore(
        overall_score=final_score,
        risk_level=risk_level,
        vehicle_type=vehicle.get("name", vehicle_type),
        factors=factors[:5],
        recommendations=recommendations[:4]
    )

def generate_hazard_alerts(waypoints_weather: List[WaypointWeather], departure_time: datetime) -> List[HazardAlert]:
    """Generate proactive hazard alerts with countdown timers."""
    alerts = []
    
    for wp in waypoints_weather:
        if not wp.weather:
            continue
            
        distance = wp.waypoint.distance_from_start or 0
        eta_mins = wp.waypoint.eta_minutes or int(distance / 55 * 60)
        
        # Wind hazards
        wind_str = wp.weather.wind_speed or "0 mph"
        try:
            wind_speed = int(''.join(filter(str.isdigit, wind_str.split()[0])))
        except:
            wind_speed = 0
            
        if wind_speed > 25:
            severity = "extreme" if wind_speed > 40 else "high" if wind_speed > 30 else "medium"
            alerts.append(HazardAlert(
                type="wind",
                severity=severity,
                distance_miles=distance,
                eta_minutes=eta_mins,
                message=f"Strong winds of {wind_speed} mph",
                recommendation=f"Reduce speed to {max(35, 65 - wind_speed + 25)} mph",
                countdown_text=f"High winds in {eta_mins} minutes" if eta_mins > 0 else "High winds at start"
            ))
            
        # Rain/visibility hazards
        conditions = (wp.weather.conditions or "").lower()
        if "heavy rain" in conditions or "storm" in conditions:
            alerts.append(HazardAlert(
                type="rain",
                severity="high",
                distance_miles=distance,
                eta_minutes=eta_mins,
                message="Heavy rain expected",
                recommendation="Reduce speed, increase following distance to 4 seconds",
                countdown_text=f"Heavy rain in {eta_mins} minutes at mile {int(distance)}"
            ))
        elif "rain" in conditions or "shower" in conditions:
            alerts.append(HazardAlert(
                type="rain",
                severity="medium",
                distance_miles=distance,
                eta_minutes=eta_mins,
                message="Rain expected",
                recommendation="Turn on headlights and wipers",
                countdown_text=f"Rain in {eta_mins} minutes"
            ))
            
        # Snow/ice hazards
        if "snow" in conditions:
            alerts.append(HazardAlert(
                type="snow",
                severity="high",
                distance_miles=distance,
                eta_minutes=eta_mins,
                message="Snow conditions expected",
                recommendation="Reduce speed by 50%, use winter tires if available",
                countdown_text=f"Snow conditions in {eta_mins} minutes"
            ))
            
        # Temperature-based ice warnings
        temp = wp.weather.temperature or 70
        if temp <= 32:
            alerts.append(HazardAlert(
                type="ice",
                severity="high",
                distance_miles=distance,
                eta_minutes=eta_mins,
                message=f"Freezing temperature ({temp}°F) - ice risk",
                recommendation="Watch for black ice on bridges and overpasses",
                countdown_text=f"Ice risk zone in {eta_mins} minutes"
            ))
            
        # Fog warnings
        if "fog" in conditions:
            alerts.append(HazardAlert(
                type="visibility",
                severity="high",
                distance_miles=distance,
                eta_minutes=eta_mins,
                message="Fog reducing visibility",
                recommendation="Use low beams, reduce speed to match visibility",
                countdown_text=f"Fog in {eta_mins} minutes"
            ))
            
        # Weather alerts from NOAA
        for alert in wp.alerts:
            severity_map = {"Extreme": "extreme", "Severe": "high", "Moderate": "medium"}
            alerts.append(HazardAlert(
                type="alert",
                severity=severity_map.get(alert.severity, "medium"),
                distance_miles=distance,
                eta_minutes=eta_mins,
                message=alert.event,
                recommendation=alert.headline[:100],
                countdown_text=f"{alert.event} in {eta_mins} minutes"
            ))
    
    # Sort by distance and deduplicate similar alerts
    alerts.sort(key=lambda x: x.distance_miles)
    return alerts[:10]  # Return top 10 alerts

async def find_rest_stops(route_geometry: str, waypoints_weather: List[WaypointWeather]) -> List[RestStop]:
    """Find rest stops, gas stations along the route with weather at arrival."""
    rest_stops = []
    route_coords = polyline.decode(route_geometry)
    
    # Sample points along route (every ~75 miles)
    total_points = len(route_coords)
    sample_interval = max(1, total_points // 5)
    
    for i in range(sample_interval, total_points - sample_interval, sample_interval):
        lat, lon = route_coords[i]
        
        # Calculate approximate distance and ETA
        approx_distance = (i / total_points) * (waypoints_weather[-1].waypoint.distance_from_start or 100)
        approx_eta = int(approx_distance / 55 * 60)
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Search for POIs near this point
                url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/rest+stop+gas+station.json"
                params = {
                    'access_token': MAPBOX_ACCESS_TOKEN,
                    'proximity': f"{lon},{lat}",
                    'types': 'poi',
                    'limit': 2
                }
                response = await client.get(url, params=params)
                
                if response.status_code == 200:
                    data = response.json()
                    for feature in data.get('features', [])[:1]:
                        place_name = feature.get('text', 'Rest Stop')
                        coords = feature.get('center', [lon, lat])
                        
                        # Find nearest waypoint weather
                        weather_desc = "Unknown"
                        temp = None
                        for wp in waypoints_weather:
                            if wp.weather and abs(wp.waypoint.distance_from_start - approx_distance) < 30:
                                weather_desc = wp.weather.conditions or "Clear"
                                temp = wp.weather.temperature
                                break
                        
                        # Generate recommendation
                        recommendation = "Good rest stop option"
                        if temp and temp > 85:
                            recommendation = "Cool down and hydrate here"
                        elif "rain" in weather_desc.lower():
                            recommendation = "Wait out the rain here"
                        elif "clear" in weather_desc.lower() or "sunny" in weather_desc.lower():
                            recommendation = "Good weather - stretch your legs!"
                            
                        rest_stops.append(RestStop(
                            name=place_name,
                            type="rest_area",
                            lat=coords[1],
                            lon=coords[0],
                            distance_miles=round(approx_distance, 1),
                            eta_minutes=approx_eta,
                            weather_at_arrival=weather_desc,
                            temperature_at_arrival=temp,
                            recommendation=recommendation
                        ))
        except Exception as e:
            logger.error(f"Error finding rest stops: {e}")
            
    return rest_stops[:5]

def generate_trucker_warnings(waypoints_weather: List[WaypointWeather], vehicle_height_ft: Optional[float] = None) -> List[str]:
    """Generate trucker-specific warnings for high-profile vehicles."""
    warnings = []
    
    for wp in waypoints_weather:
        if not wp.weather:
            continue
            
        distance = wp.waypoint.distance_from_start or 0
        location = wp.waypoint.name or f"Mile {int(distance)}"
        
        # Wind warnings for high-profile vehicles
        wind_str = wp.weather.wind_speed or "0 mph"
        try:
            wind_speed = int(''.join(filter(str.isdigit, wind_str.split()[0])))
        except:
            wind_speed = 0
            
        if wind_speed > 20:
            if wind_speed > 35:
                warnings.append(f"⚠️ DANGER: {wind_speed} mph winds at {location} - Consider stopping until winds subside")
            elif wind_speed > 25:
                warnings.append(f"🚛 High crosswind risk ({wind_speed} mph) at {location} - Reduce speed significantly")
            else:
                warnings.append(f"💨 Moderate winds ({wind_speed} mph) at {location} - Stay alert")
                
        # Snow/ice warnings
        conditions = (wp.weather.conditions or "").lower()
        temp = wp.weather.temperature or 70
        
        if "snow" in conditions:
            warnings.append(f"❄️ Snow at {location} - Chain requirements may be in effect")
            
        if temp <= 32:
            warnings.append(f"🧊 Freezing temps at {location} - Bridge decks may be icy")
            
        # Visibility
        if "fog" in conditions:
            warnings.append(f"🌫️ Reduced visibility at {location} - Maintain safe following distance")
            
    # Deduplicate similar warnings
    unique_warnings = []
    seen = set()
    for w in warnings:
        key = w.split(" - ")[0]
        if key not in seen:
            unique_warnings.append(w)
            seen.add(key)
            
    return unique_warnings[:8]

def calculate_optimal_departure(origin: str, destination: str, waypoints_weather: List[WaypointWeather], base_departure: datetime) -> Optional[DepartureWindow]:
    """Calculate optimal departure window based on weather patterns."""
    # Analyze current conditions
    current_hazards = 0
    current_conditions = []
    
    for wp in waypoints_weather:
        if wp.weather:
            conditions = (wp.weather.conditions or "").lower()
            if any(bad in conditions for bad in ["rain", "storm", "snow", "fog"]):
                current_hazards += 1
                current_conditions.append(wp.weather.conditions)
        current_hazards += len(wp.alerts)
    
    # Calculate current safety score
    safety = calculate_safety_score(waypoints_weather, "car")
    
    # Generate recommendation
    if current_hazards == 0 and safety.overall_score >= 80:
        recommendation = "✅ Current departure time is optimal - clear conditions expected"
        conditions_summary = "Good driving conditions throughout your route"
    elif current_hazards <= 2 and safety.overall_score >= 60:
        recommendation = "👍 Acceptable conditions - drive with caution"
        conditions_summary = f"Some weather: {', '.join(list(set(current_conditions))[:2]) if current_conditions else 'Minor concerns'}"
    else:
        # Suggest waiting
        recommendation = "⏰ Consider departing 2-3 hours later for improved conditions"
        conditions_summary = f"Current concerns: {', '.join(list(set(current_conditions))[:3]) if current_conditions else 'Weather alerts active'}"
    
    # Calculate estimated arrival
    total_duration = waypoints_weather[-1].waypoint.eta_minutes if waypoints_weather else 120
    arrival_time = base_departure + timedelta(minutes=total_duration)
    
    return DepartureWindow(
        departure_time=base_departure.isoformat(),
        arrival_time=arrival_time.isoformat(),
        safety_score=safety.overall_score,
        hazard_count=current_hazards,
        recommendation=recommendation,
        conditions_summary=conditions_summary
    )

def derive_road_condition(weather: Optional[WeatherData], alerts: List[WeatherAlert]) -> RoadCondition:
    """Derive road surface condition from weather data."""
    if not weather:
        return RoadCondition(
            condition="unknown",
            severity=0,
            label="UNKNOWN",
            icon="❓",
            color="#6b7280",
            description="Weather data unavailable",
            recommendation="Drive with normal caution"
        )
    
    temp = weather.temperature or 50
    conditions = (weather.conditions or "").lower()
    wind_str = weather.wind_speed or "0 mph"
    
    try:
        wind_speed = int(''.join(filter(str.isdigit, wind_str.split()[0])))
    except:
        wind_speed = 0
    
    # Check for severe alerts first
    severe_alerts = [a for a in alerts if a.severity in ["Extreme", "Severe"]]
    if severe_alerts:
        for alert in severe_alerts:
            event = alert.event.lower()
            if "flood" in event or "flash flood" in event:
                return RoadCondition(
                    condition="flooded",
                    severity=4,
                    label="FLOODING",
                    icon="🌊",
                    color="#dc2626",
                    description=f"Flash flood warning - {alert.headline[:60]}",
                    recommendation="🚫 DO NOT DRIVE - Find alternate route immediately"
                )
            if "ice" in event or "freezing" in event:
                return RoadCondition(
                    condition="icy",
                    severity=3,
                    label="ICY",
                    icon="🧊",
                    color="#ef4444",
                    description=f"Ice storm - {alert.headline[:60]}",
                    recommendation="⚠️ DANGEROUS - Avoid travel if possible"
                )
    
    # Ice conditions (freezing temp + any precipitation)
    if temp <= 32 and any(w in conditions for w in ["rain", "drizzle", "freezing", "sleet", "ice"]):
        return RoadCondition(
            condition="icy",
            severity=3,
            label="ICY ROADS",
            icon="🧊",
            color="#ef4444",
            description=f"Freezing precipitation at {temp}°F",
            recommendation="⚠️ Black ice likely - Reduce speed to 25 mph on bridges"
        )
    
    # Snow covered
    if "snow" in conditions or "blizzard" in conditions:
        severity = 3 if "heavy" in conditions or "blizzard" in conditions else 2
        return RoadCondition(
            condition="snow_covered",
            severity=severity,
            label="SNOW",
            icon="❄️",
            color="#93c5fd",
            description=f"Snow conditions at {temp}°F",
            recommendation="🚗 Reduce speed 50%, increase following distance to 8 seconds"
        )
    
    # Potential ice (just below freezing, roads may have frozen overnight)
    if temp <= 36 and temp > 32:
        return RoadCondition(
            condition="slippery",
            severity=2,
            label="SLIPPERY",
            icon="⚠️",
            color="#f59e0b",
            description=f"Near-freezing {temp}°F - bridges/overpasses may be icy",
            recommendation="⚡ Watch for black ice on elevated surfaces"
        )
    
    # Low visibility
    if "fog" in conditions or "mist" in conditions or "smoke" in conditions:
        return RoadCondition(
            condition="low_visibility",
            severity=2,
            label="LOW VIS",
            icon="🌫️",
            color="#9ca3af",
            description="Fog/reduced visibility",
            recommendation="💡 Low beams only, reduce speed to match visibility"
        )
    
    # Dangerous wind
    if wind_speed > 35:
        return RoadCondition(
            condition="dangerous_wind",
            severity=3,
            label="HIGH WIND",
            icon="💨",
            color="#8b5cf6",
            description=f"Dangerous crosswinds at {wind_speed} mph",
            recommendation="🚛 HIGH-PROFILE VEHICLES: Consider stopping until winds subside"
        )
    
    # Wet roads
    if any(w in conditions for w in ["rain", "shower", "drizzle", "storm", "thunder"]):
        severity = 2 if "heavy" in conditions or "thunder" in conditions else 1
        return RoadCondition(
            condition="wet",
            severity=severity,
            label="WET",
            icon="💧",
            color="#3b82f6",
            description=f"Wet roads - {conditions}",
            recommendation="🌧️ Headlights on, increase following distance to 4 seconds"
        )
    
    # Dry/good conditions
    return RoadCondition(
        condition="dry",
        severity=0,
        label="DRY",
        icon="✓",
        color="#22c55e",
        description=f"Good conditions - {temp}°F, {conditions or 'Clear'}",
        recommendation="✅ Normal driving conditions"
    )

async def get_turn_by_turn_directions(origin_coords: tuple, dest_coords: tuple, waypoints_weather: List[WaypointWeather]) -> List[TurnByTurnStep]:
    """Get turn-by-turn directions with road conditions from Mapbox."""
    steps = []
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            coords_str = f"{origin_coords[1]},{origin_coords[0]};{dest_coords[1]},{dest_coords[0]}"
            url = f"https://api.mapbox.com/directions/v5/mapbox/driving/{coords_str}"
            params = {
                'access_token': MAPBOX_ACCESS_TOKEN,
                'steps': 'true',
                'geometries': 'polyline',
                'overview': 'full',
                'annotations': 'distance,duration'
            }
            
            response = await client.get(url, params=params)
            if response.status_code != 200:
                return steps
                
            data = response.json()
            if not data.get('routes'):
                return steps
            
            route = data['routes'][0]
            legs = route.get('legs', [])
            
            cumulative_distance = 0
            
            for leg in legs:
                for step in leg.get('steps', []):
                    distance_mi = step.get('distance', 0) / 1609.34  # meters to miles
                    duration_min = step.get('duration', 0) / 60  # seconds to minutes
                    cumulative_distance += distance_mi
                    
                    maneuver = step.get('maneuver', {})
                    instruction = maneuver.get('instruction', 'Continue')
                    maneuver_type = maneuver.get('type', 'straight')
                    
                    # Get road name
                    road_name = step.get('name', 'Unnamed road')
                    if not road_name:
                        road_name = step.get('ref', 'Local road')
                    
                    # Find nearest waypoint for weather/road condition
                    road_condition = None
                    weather_desc = None
                    temperature = None
                    has_alert = False
                    
                    for wp in waypoints_weather:
                        if wp.waypoint.distance_from_start and abs(wp.waypoint.distance_from_start - cumulative_distance) < 30:
                            if wp.weather:
                                road_condition = derive_road_condition(wp.weather, wp.alerts)
                                weather_desc = wp.weather.conditions
                                temperature = wp.weather.temperature
                            has_alert = len(wp.alerts) > 0
                            break
                    
                    # Only add significant steps (> 0.1 miles or has maneuver)
                    if distance_mi > 0.1 or maneuver_type not in ['straight', 'new name']:
                        steps.append(TurnByTurnStep(
                            instruction=instruction,
                            distance_miles=round(distance_mi, 1),
                            duration_minutes=round(duration_min),
                            road_name=road_name,
                            maneuver=maneuver_type,
                            road_condition=road_condition,
                            weather_at_step=weather_desc,
                            temperature=temperature,
                            has_alert=has_alert
                        ))
    
    except Exception as e:
        logger.error(f"Turn-by-turn directions error: {e}")
    
    return steps[:50]  # Limit to 50 steps

def analyze_route_conditions(waypoints_weather: List[WaypointWeather]) -> tuple:
    """Analyze all road conditions along route and determine if reroute is needed."""
    all_conditions = []
    worst_severity = 0
    worst_condition = "dry"
    reroute_needed = False
    reroute_reason = None
    
    for wp in waypoints_weather:
        road_cond = derive_road_condition(wp.weather, wp.alerts)
        all_conditions.append(road_cond)
        
        if road_cond.severity > worst_severity:
            worst_severity = road_cond.severity
            worst_condition = road_cond.condition
        
        # Check if reroute should be recommended
        if road_cond.severity >= 3:
            reroute_needed = True
            if not reroute_reason:
                location = wp.waypoint.name or f"Mile {int(wp.waypoint.distance_from_start or 0)}"
                reroute_reason = f"{road_cond.label} conditions at {location} - {road_cond.description}"
    
    # Generate summary
    condition_counts = {}
    for c in all_conditions:
        if c.condition != "dry":
            condition_counts[c.label] = condition_counts.get(c.label, 0) + 1
    
    if not condition_counts:
        summary = "✅ Good road conditions expected throughout your route"
    else:
        summary_parts = [f"{count} segments with {label}" for label, count in condition_counts.items()]
        summary = f"⚠️ Road hazards detected: {', '.join(summary_parts)}"
    
    return summary, worst_condition, reroute_needed, reroute_reason

async def generate_ai_summary(waypoints_weather: List[WaypointWeather], origin: str, destination: str, packing: List[PackingSuggestion]) -> str:
    """Generate AI-powered weather summary using Gemini Flash."""
    try:
        # Build weather context
        weather_info = []
        all_alerts = []
        
        for wp in waypoints_weather:
            if wp.weather:
                info = f"- {wp.waypoint.name} ({wp.waypoint.distance_from_start} mi): "
                info += f"{wp.weather.temperature}°{wp.weather.temperature_unit}, "
                info += f"{wp.weather.conditions}, Wind: {wp.weather.wind_speed} {wp.weather.wind_direction}"
                if wp.waypoint.arrival_time:
                    info += f" (ETA: {wp.waypoint.arrival_time[:16]})"
                weather_info.append(info)
            
            for alert in wp.alerts:
                all_alerts.append(f"- {alert.event}: {alert.headline}")
        
        weather_text = "\n".join(weather_info) if weather_info else "No weather data available"
        alerts_text = "\n".join(set(all_alerts)) if all_alerts else "No active alerts"
        packing_text = ", ".join([p.item for p in packing[:5]]) if packing else "Standard travel items"
        
        prompt = f"""You are a helpful travel weather assistant. Provide a brief, driver-friendly weather summary for a road trip.

Route: {origin} to {destination}

Weather along route:
{weather_text}

Active Alerts:
{alerts_text}

Suggested packing: {packing_text}

Provide a 2-3 sentence summary focusing on:
1. Overall driving conditions
2. Any weather concerns or hazards
3. Key recommendations for the driver

Be concise and practical."""

        # Use Google Gemini for AI summary
        if not GOOGLE_API_KEY:
            return "AI summary unavailable - Google API key not configured."
        
        model = genai.GenerativeModel('gemini-2.0-flash')
        response = await asyncio.to_thread(
            model.generate_content,
            prompt
        )
        
        return response.text if response.text else "Unable to generate summary."
    except Exception as e:
        logger.error(f"AI summary error: {e}")
        return f"Weather summary unavailable. Check individual waypoints for conditions."

# ==================== API Routes ====================

@api_router.get("/")
async def root():
    return {"message": "Routecast API", "version": "2.0", "features": ["departure_time", "multi_stop", "favorites", "packing_suggestions", "weather_timeline"]}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

@api_router.post("/route/weather", response_model=RouteWeatherResponse)
async def get_route_weather(request: RouteRequest):
    """Get weather along a route from origin to destination."""
    logger.info(f"Route weather request: {request.origin} -> {request.destination}")
    
    # Parse departure time
    departure_time = None
    if request.departure_time:
        try:
            departure_time = datetime.fromisoformat(request.departure_time.replace('Z', '+00:00'))
        except:
            departure_time = datetime.now()
    else:
        departure_time = datetime.now()
    
    # Geocode origin and destination
    origin_coords = await geocode_location(request.origin)
    if not origin_coords:
        raise HTTPException(status_code=400, detail=f"Could not geocode origin: {request.origin}")
    
    dest_coords = await geocode_location(request.destination)
    if not dest_coords:
        raise HTTPException(status_code=400, detail=f"Could not geocode destination: {request.destination}")
    
    # Geocode stops if any
    stop_coords = []
    if request.stops:
        for stop in request.stops:
            coords = await geocode_location(stop.location)
            if coords:
                stop_coords.append(coords)
    
    # Get route from Mapbox
    route_data = await get_mapbox_route(origin_coords, dest_coords, stop_coords if stop_coords else None)
    if not route_data:
        # Provide helpful error message for unreachable routes
        raise HTTPException(
            status_code=400, 
            detail=f"No drivable route found between {request.origin} and {request.destination}. These locations may not be connected by roads (e.g., Nome, Alaska is only accessible by air). Try different locations."
        )
    
    route_geometry = route_data['geometry']
    total_duration = int(route_data.get('duration', 0))
    
    # Extract waypoints along route
    waypoints = extract_waypoints_from_route(route_geometry, interval_miles=50, departure_time=departure_time)
    if not waypoints:
        raise HTTPException(status_code=500, detail="Could not extract waypoints from route")
    
    # Get weather for each waypoint (with concurrent requests)
    waypoints_weather = []
    has_severe = False
    
    async def fetch_waypoint_weather(wp: Waypoint, index: int, total: int, origin_name: str, dest_name: str) -> WaypointWeather:
        nonlocal has_severe
        weather = await get_noaa_weather(wp.lat, wp.lon)
        alerts = await get_noaa_alerts(wp.lat, wp.lon)
        
        # Get location name via reverse geocoding
        location_name = await reverse_geocode(wp.lat, wp.lon)
        
        # Build display name with point number and location
        if index == 0:
            display_name = f"Start - {origin_name}"
        elif index == total - 1:
            display_name = f"End - {dest_name}"
        else:
            point_label = f"Point {index}"
            if location_name:
                display_name = f"{point_label} - {location_name}"
            else:
                display_name = point_label
        
        # Update waypoint with location name
        updated_wp = Waypoint(
            lat=wp.lat,
            lon=wp.lon,
            name=display_name,
            distance_from_start=wp.distance_from_start,
            eta_minutes=wp.eta_minutes,
            arrival_time=wp.arrival_time
        )
        
        # Check for severe weather
        severe_severities = ['Extreme', 'Severe']
        if any(a.severity in severe_severities for a in alerts):
            has_severe = True
        
        return WaypointWeather(
            waypoint=updated_wp,
            weather=weather,
            alerts=alerts
        )
    
    # Fetch weather concurrently
    total_waypoints = len(waypoints)
    tasks = [fetch_waypoint_weather(wp, i, total_waypoints, request.origin, request.destination) for i, wp in enumerate(waypoints)]
    waypoints_weather = await asyncio.gather(*tasks)
    
    # Generate packing suggestions
    packing_suggestions = generate_packing_suggestions(list(waypoints_weather))
    
    # Build weather timeline
    weather_timeline = build_weather_timeline(list(waypoints_weather))
    
    # Generate AI summary
    ai_summary = await generate_ai_summary(list(waypoints_weather), request.origin, request.destination, packing_suggestions)
    
    # NEW: Calculate safety score based on vehicle type
    vehicle_type = request.vehicle_type or "car"
    safety_score = calculate_safety_score(list(waypoints_weather), vehicle_type)
    
    # NEW: Generate hazard alerts with countdown
    hazard_alerts = generate_hazard_alerts(list(waypoints_weather), departure_time)
    
    # NEW: Find rest stops along the route
    rest_stops = await find_rest_stops(route_geometry, list(waypoints_weather))
    
    # NEW: Calculate optimal departure window
    optimal_departure = calculate_optimal_departure(request.origin, request.destination, list(waypoints_weather), departure_time)
    
    # NEW: Generate trucker-specific warnings if enabled
    trucker_warnings = []
    if request.trucker_mode:
        trucker_warnings = generate_trucker_warnings(list(waypoints_weather), request.vehicle_height_ft)
    
    # NEW: Analyze road conditions
    road_condition_summary, worst_road_condition, reroute_recommended, reroute_reason = analyze_route_conditions(list(waypoints_weather))
    
    # NEW: Get turn-by-turn directions with road conditions
    turn_by_turn = await get_turn_by_turn_directions(origin_coords, dest_coords, list(waypoints_weather))
    
    # Calculate total distance
    total_distance = route_data.get('distance', 0) / 1609.34  # meters to miles
    
    response = RouteWeatherResponse(
        origin=request.origin,
        destination=request.destination,
        stops=request.stops or [],
        departure_time=departure_time.isoformat(),
        total_duration_minutes=total_duration,
        total_distance_miles=round(total_distance, 1),
        route_geometry=route_geometry,
        waypoints=list(waypoints_weather),
        ai_summary=ai_summary,
        has_severe_weather=has_severe,
        packing_suggestions=packing_suggestions,
        weather_timeline=weather_timeline,
        # New fields
        safety_score=safety_score,
        hazard_alerts=hazard_alerts,
        rest_stops=rest_stops,
        optimal_departure=optimal_departure,
        trucker_warnings=trucker_warnings,
        vehicle_type=vehicle_type,
        # Road conditions and navigation
        turn_by_turn=turn_by_turn,
        road_condition_summary=road_condition_summary,
        worst_road_condition=worst_road_condition,
        reroute_recommended=reroute_recommended,
        reroute_reason=reroute_reason
    )
    
    # Save to database
    try:
        await db.routes.insert_one(response.model_dump())
    except Exception as e:
        logger.error(f"Error saving route: {e}")
    
    return response

@api_router.get("/routes/history", response_model=List[SavedRoute])
async def get_route_history():
    """Get recent route history."""
    try:
        routes = await db.routes.find().sort("created_at", -1).limit(10).to_list(10)
        return [SavedRoute(
            id=str(r.get('_id', r.get('id'))),
            origin=r['origin'],
            destination=r['destination'],
            stops=r.get('stops', []),
            is_favorite=r.get('is_favorite', False),
            created_at=r.get('created_at', datetime.utcnow())
        ) for r in routes]
    except Exception as e:
        logger.error(f"Error fetching route history: {e}")
        return []

@api_router.get("/routes/favorites", response_model=List[SavedRoute])
async def get_favorite_routes():
    """Get favorite routes."""
    try:
        routes = await db.favorites.find().sort("created_at", -1).limit(20).to_list(20)
        return [SavedRoute(
            id=r.get('id', str(r.get('_id'))),
            origin=r['origin'],
            destination=r['destination'],
            stops=r.get('stops', []),
            is_favorite=True,
            created_at=r.get('created_at', datetime.utcnow())
        ) for r in routes]
    except Exception as e:
        logger.error(f"Error fetching favorites: {e}")
        return []

@api_router.post("/routes/favorites")
async def add_favorite_route(request: FavoriteRouteRequest):
    """Add a route to favorites."""
    try:
        favorite = {
            "id": str(uuid.uuid4()),
            "origin": request.origin,
            "destination": request.destination,
            "stops": [s.model_dump() for s in (request.stops or [])],
            "name": request.name or f"{request.origin} to {request.destination}",
            "is_favorite": True,
            "created_at": datetime.utcnow()
        }
        await db.favorites.insert_one(favorite)
        return {"success": True, "id": favorite["id"]}
    except Exception as e:
        logger.error(f"Error saving favorite: {e}")
        raise HTTPException(status_code=500, detail="Could not save favorite")

@api_router.delete("/routes/favorites/{route_id}")
async def remove_favorite_route(route_id: str):
    """Remove a route from favorites."""
    try:
        from bson import ObjectId
        # Try custom id field first
        result = await db.favorites.delete_one({"id": route_id})
        if result.deleted_count == 0:
            # Try with MongoDB ObjectId
            try:
                result = await db.favorites.delete_one({"_id": ObjectId(route_id)})
            except:
                pass
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Favorite not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing favorite: {e}")
        raise HTTPException(status_code=500, detail="Could not remove favorite")

@api_router.get("/routes/{route_id}", response_model=RouteWeatherResponse)
async def get_route_by_id(route_id: str):
    """Get a specific route by ID."""
    try:
        route = await db.routes.find_one({"id": route_id})
        if not route:
            raise HTTPException(status_code=404, detail="Route not found")
        return RouteWeatherResponse(**route)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching route {route_id}: {e}")
        raise HTTPException(status_code=500, detail="Error fetching route")

@api_router.post("/geocode")
async def geocode(location: str):
    """Geocode a location string."""
    coords = await geocode_location(location)
    if not coords:
        raise HTTPException(status_code=404, detail="Location not found")
    return coords

@api_router.get("/geocode/autocomplete")
async def autocomplete_location(query: str, limit: int = 5):
    """Get autocomplete suggestions for a location query using Mapbox."""
    if not query or len(query) < 2:
        return []
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json"
            params = {
                'access_token': MAPBOX_ACCESS_TOKEN,
                'autocomplete': 'true',
                'types': 'place,locality,address,poi',
                'country': 'US,PR,VI,GU,AS',  # US + Puerto Rico + Virgin Islands + Guam + American Samoa
                'limit': limit
            }
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            suggestions = []
            for feature in data.get('features', []):
                place_name = feature.get('place_name', '')
                text = feature.get('text', '')
                
                # Extract components
                context = feature.get('context', [])
                region = ''
                for ctx in context:
                    if ctx.get('id', '').startswith('region'):
                        region = ctx.get('short_code', '').replace('US-', '').replace('PR-', 'PR').replace('VI-', 'VI')
                        break
                
                suggestions.append({
                    'place_name': place_name,
                    'short_name': f"{text}, {region}" if region else text,
                    'coordinates': feature.get('center', []),
                })
            
            return suggestions
    except Exception as e:
        logger.error(f"Autocomplete error for '{query}': {e}")
        return []

@api_router.post("/chat", response_model=ChatResponse)
async def driver_chat(request: ChatMessage):
    """AI-powered chat for drivers to ask questions about weather, routes, and driving."""
    try:
        if not GOOGLE_API_KEY:
            return ChatResponse(
                response="AI chat is not configured. Please set GOOGLE_API_KEY in environment variables.",
                suggestions=["Check road conditions", "View weather alerts"]
            )
        
        # Build the prompt
        system_message = """You are Routecast AI, a helpful driving assistant that helps drivers with:
- Weather and road condition questions
- Safe driving tips based on weather
- Route planning advice
- What to pack for a trip
- Rest stop recommendations
- Understanding weather alerts and hazards

Keep responses concise (2-3 sentences max) and actionable. Use emojis sparingly.
If asked about specific locations, provide general advice since you don't have real-time data in this chat.
Always prioritize safety in your recommendations."""
        
        message_text = request.message
        if request.route_context:
            message_text = f"[Route context: {request.route_context}]\n\nUser question: {request.message}"
        
        full_prompt = f"{system_message}\n\nUser: {message_text}"
        
        # Use Google Gemini
        model = genai.GenerativeModel('gemini-2.0-flash')
        response = await asyncio.to_thread(
            model.generate_content,
            full_prompt
        )
        
        response_text = response.text if response.text else "I'm having trouble responding right now."
        
        # Generate quick suggestions based on the question
        suggestions = []
        question_lower = request.message.lower()
        
        if "ice" in question_lower or "snow" in question_lower:
            suggestions = ["What speed should I drive in snow?", "Do I need chains?", "Black ice tips"]
        elif "rain" in question_lower:
            suggestions = ["Hydroplaning prevention", "Following distance in rain", "When to pull over"]
        elif "wind" in question_lower:
            suggestions = ["Safe driving in high winds", "Should I delay my trip?"]
        elif "fog" in question_lower:
            suggestions = ["Fog driving tips", "What lights to use in fog"]
        elif "tired" in question_lower or "fatigue" in question_lower:
            suggestions = ["Rest stop tips", "Signs of drowsy driving", "Coffee vs. nap"]
        else:
            suggestions = ["Check road conditions", "Safest time to drive", "Packing tips"]
        
        return ChatResponse(
            response=response_text,
            suggestions=suggestions[:3]
        )
        
    except Exception as e:
        logger.error(f"Chat error: {e}")
        return ChatResponse(
            response="I'm having trouble connecting right now. Please check your route conditions on the main screen or try again in a moment.",
            suggestions=["Check road conditions", "View weather alerts", "Contact support"]
        )

# ==================== Push Notifications ====================

@api_router.post("/push-tokens", response_model=PushTokenResponse)
async def register_push_token(request: PushTokenRequest):
    """
    Register a push notification token for the device.
    This endpoint stores tokens for sending notifications via Expo's push service.
    """
    try:
        # Store in MongoDB
        token_doc = {
            "token": request.token,
            "platform": request.platform,
            "userId": request.userId,
            "timestamp": request.timestamp or datetime.utcnow().isoformat(),
            "active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        # Upsert based on token (update if exists, insert if new)
        await db.push_tokens.update_one(
            {"token": request.token},
            {"$set": token_doc},
            upsert=True
        )
        
        logger.info(f"Push token registered: {request.platform} - {request.token[:20]}...")
        
        return PushTokenResponse(
            success=True,
            message="Push token registered successfully"
        )
    except Exception as e:
        logger.error(f"Error registering push token: {e}")
        return PushTokenResponse(
            success=False,
            message=f"Error: {str(e)}"
        )

@api_router.delete("/push-tokens/{token}")
async def unregister_push_token(token: str):
    """
    Unregister a push notification token (mark as inactive).
    """
    try:
        result = await db.push_tokens.update_one(
            {"token": token},
            {"$set": {"active": False, "updated_at": datetime.utcnow()}}
        )
        
        if result.modified_count > 0:
            return {"success": True, "message": "Token unregistered"}
        else:
            return {"success": False, "message": "Token not found"}
    except Exception as e:
        logger.error(f"Error unregistering push token: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== Boondocker Models ====================

class ChecklistItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    checked: bool = False
    is_default: bool = True

class ChecklistResponse(BaseModel):
    items: List[ChecklistItem]

class PlaceResult(BaseModel):
    name: str
    address: str
    latitude: float
    longitude: float
    rating: Optional[float] = None
    total_ratings: Optional[int] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    place_id: str
    distance_miles: Optional[float] = None
    is_open: Optional[bool] = None
    types: List[str] = []

class PlacesSearchResponse(BaseModel):
    results: List[PlaceResult]
    total: int

class SolarForecastRequest(BaseModel):
    latitude: float
    longitude: float
    panel_watts: float = 400
    battery_capacity_ah: float = 200
    daily_consumption_wh: float = 2000

class SolarForecastResponse(BaseModel):
    location: str
    forecast_date: str
    sunrise: str
    sunset: str
    daylight_hours: float
    cloud_cover_percent: int
    expected_sun_hours: float
    estimated_production_wh: float
    consumption_wh: float
    net_energy_wh: float
    battery_charge_percent: float
    recommendation: str

class PropaneUsageRequest(BaseModel):
    latitude: float
    longitude: float
    heater_btu: float = 30000
    cooking_hours_per_day: float = 1.0
    water_heater_btu: float = 10000
    tank_size_gallons: float = 20

class PropaneUsageResponse(BaseModel):
    location: str
    current_temp: int
    low_temp: int
    heating_hours_needed: float
    daily_propane_gallons: float
    days_until_empty: float
    recommendation: str

class WindShelterRequest(BaseModel):
    latitude: float
    longitude: float
    rv_length_ft: float = 30

class WindShelterResponse(BaseModel):
    location: str
    wind_speed_mph: int
    wind_direction: str
    wind_gust_mph: Optional[int]
    recommended_orientation: str
    shelter_score: int
    tips: List[str]

class ConnectivityResponse(BaseModel):
    latitude: float
    longitude: float
    location_name: str
    carriers: List[Dict[str, Any]]
    overall_rating: str
    recommendation: str

class CampsiteIndexRequest(BaseModel):
    latitude: float
    longitude: float

class CampsiteIndexResponse(BaseModel):
    latitude: float
    longitude: float
    location_name: str
    overall_score: int
    overall_rating: str
    factors: Dict[str, Dict[str, Any]]
    recommendation: str

# ==================== Trucker Models ====================

class TruckStopResult(BaseModel):
    name: str
    address: str
    latitude: float
    longitude: float
    distance_miles: float
    rating: Optional[float] = None
    amenities: List[str] = []
    fuel_prices: Optional[Dict[str, float]] = None
    phone: Optional[str] = None
    is_open: Optional[bool] = None

class WeighStationResult(BaseModel):
    name: str
    location: str
    latitude: float
    longitude: float
    distance_miles: float
    highway: str
    direction: str
    status: str  # open, closed, unknown
    bypass_available: bool

class BridgeClearanceResult(BaseModel):
    location: str
    latitude: float
    longitude: float
    clearance_ft: float
    highway: str
    direction: Optional[str]
    distance_miles: float
    warning_level: str  # safe, caution, danger

class TruckParkingResult(BaseModel):
    name: str
    address: str
    latitude: float
    longitude: float
    distance_miles: float
    spaces_total: Optional[int] = None
    spaces_available: Optional[int] = None
    amenities: List[str] = []
    is_free: bool = False

class WeightRestriction(BaseModel):
    road_name: str
    restriction_type: str  # weight_limit, seasonal, bridge
    max_weight_tons: Optional[float] = None
    description: str
    latitude: float
    longitude: float
    distance_miles: float

# ==================== Helper Functions for Places API ====================

async def search_google_places(
    latitude: float, 
    longitude: float, 
    query: str = None,
    place_type: str = None,
    radius_meters: int = 16093,  # 10 miles default
    keyword: str = None
) -> List[PlaceResult]:
    """Search Google Places API for nearby locations."""
    results = []
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Use nearby search
            url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
            params = {
                'location': f"{latitude},{longitude}",
                'radius': radius_meters,
                'key': GOOGLE_API_KEY
            }
            
            if query:
                params['keyword'] = query
            if place_type:
                params['type'] = place_type
            if keyword:
                params['keyword'] = keyword
                
            response = await client.get(url, params=params)
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('status') == 'OK':
                    for place in data.get('results', [])[:20]:
                        loc = place.get('geometry', {}).get('location', {})
                        place_lat = loc.get('lat', 0)
                        place_lon = loc.get('lng', 0)
                        
                        # Calculate distance
                        dist = haversine_distance(latitude, longitude, place_lat, place_lon)
                        
                        results.append(PlaceResult(
                            name=place.get('name', 'Unknown'),
                            address=place.get('vicinity', ''),
                            latitude=place_lat,
                            longitude=place_lon,
                            rating=place.get('rating'),
                            total_ratings=place.get('user_ratings_total'),
                            place_id=place.get('place_id', ''),
                            distance_miles=round(dist, 1),
                            is_open=place.get('opening_hours', {}).get('open_now'),
                            types=place.get('types', [])
                        ))
                else:
                    logger.warning(f"Google Places API status: {data.get('status')} - {data.get('error_message', '')}")
                    
    except Exception as e:
        logger.error(f"Google Places search error: {e}")
    
    # Sort by distance
    results.sort(key=lambda x: x.distance_miles or 999)
    return results

async def search_places_text(
    query: str,
    latitude: float,
    longitude: float,
    radius_meters: int = 32186  # 20 miles
) -> List[PlaceResult]:
    """Text search for places with location bias."""
    results = []
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
            params = {
                'query': query,
                'location': f"{latitude},{longitude}",
                'radius': radius_meters,
                'key': GOOGLE_API_KEY
            }
            
            response = await client.get(url, params=params)
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('status') == 'OK':
                    for place in data.get('results', [])[:20]:
                        loc = place.get('geometry', {}).get('location', {})
                        place_lat = loc.get('lat', 0)
                        place_lon = loc.get('lng', 0)
                        
                        dist = haversine_distance(latitude, longitude, place_lat, place_lon)
                        
                        results.append(PlaceResult(
                            name=place.get('name', 'Unknown'),
                            address=place.get('formatted_address', ''),
                            latitude=place_lat,
                            longitude=place_lon,
                            rating=place.get('rating'),
                            total_ratings=place.get('user_ratings_total'),
                            place_id=place.get('place_id', ''),
                            distance_miles=round(dist, 1),
                            is_open=place.get('opening_hours', {}).get('open_now'),
                            types=place.get('types', [])
                        ))
                        
    except Exception as e:
        logger.error(f"Google Places text search error: {e}")
    
    results.sort(key=lambda x: x.distance_miles or 999)
    return results

# ==================== Boondocker API Endpoints ====================

# Default camp prep checklist items
DEFAULT_CHECKLIST = [
    "Fresh water tank filled",
    "Propane tanks full", 
    "Batteries charged",
    "Grey/black tanks empty",
    "Tire pressure checked",
    "Hitch and connections secure",
    "Food and supplies stocked",
    "First aid kit packed",
    "Maps and GPS updated",
    "Emergency contact list ready"
]

@api_router.get("/boondocking/checklist")
async def get_checklist(user_id: str = "default"):
    """Get camp prep checklist for user."""
    checklist = await db.checklists.find_one({"user_id": user_id})
    
    if not checklist:
        # Return default checklist
        items = [ChecklistItem(text=item, is_default=True) for item in DEFAULT_CHECKLIST]
        return {"items": [item.dict() for item in items]}
    
    return {"items": checklist.get("items", [])}

@api_router.post("/boondocking/checklist")
async def save_checklist(items: List[dict], user_id: str = "default"):
    """Save camp prep checklist."""
    await db.checklists.update_one(
        {"user_id": user_id},
        {"$set": {"items": items, "updated_at": datetime.utcnow()}},
        upsert=True
    )
    return {"success": True}

@api_router.get("/boondocking/free-camping", response_model=PlacesSearchResponse)
async def find_free_camping(latitude: float, longitude: float, radius_miles: int = 25):
    """Find free camping and boondocking spots nearby."""
    radius_meters = int(radius_miles * 1609.34)
    
    # Search for various camping-related places
    results = []
    
    # Search for campgrounds and RV parks
    campgrounds = await search_places_text(
        "free camping boondocking dispersed camping BLM land",
        latitude, longitude, radius_meters
    )
    results.extend(campgrounds)
    
    # Also search for public lands and recreation areas
    public_lands = await search_places_text(
        "national forest campground public land camping",
        latitude, longitude, radius_meters
    )
    results.extend(public_lands)
    
    # Deduplicate by place_id
    seen = set()
    unique = []
    for r in results:
        if r.place_id not in seen:
            seen.add(r.place_id)
            unique.append(r)
    
    unique.sort(key=lambda x: x.distance_miles or 999)
    
    return PlacesSearchResponse(results=unique[:15], total=len(unique))

@api_router.get("/boondocking/casinos", response_model=PlacesSearchResponse)
async def find_casinos(latitude: float, longitude: float, radius_miles: int = 50):
    """Find casinos that may allow overnight RV parking."""
    radius_meters = int(radius_miles * 1609.34)
    
    results = await search_google_places(
        latitude, longitude,
        keyword="casino",
        place_type="casino",
        radius_meters=radius_meters
    )
    
    return PlacesSearchResponse(results=results[:15], total=len(results))

@api_router.get("/boondocking/walmart", response_model=PlacesSearchResponse)
async def find_walmart_parking(latitude: float, longitude: float, radius_miles: int = 30):
    """Find Walmart stores that may allow overnight parking."""
    radius_meters = int(radius_miles * 1609.34)
    
    results = await search_places_text(
        "Walmart Supercenter",
        latitude, longitude, radius_meters
    )
    
    return PlacesSearchResponse(results=results[:15], total=len(results))

@api_router.get("/boondocking/cracker-barrel", response_model=PlacesSearchResponse)
async def find_cracker_barrel(latitude: float, longitude: float, radius_miles: int = 50):
    """Find Cracker Barrel restaurants that allow overnight parking."""
    radius_meters = int(radius_miles * 1609.34)
    
    results = await search_places_text(
        "Cracker Barrel Old Country Store",
        latitude, longitude, radius_meters
    )
    
    return PlacesSearchResponse(results=results[:15], total=len(results))

@api_router.get("/boondocking/dump-stations", response_model=PlacesSearchResponse)
async def find_dump_stations(latitude: float, longitude: float, radius_miles: int = 30):
    """Find RV dump stations nearby."""
    radius_meters = int(radius_miles * 1609.34)
    
    results = await search_places_text(
        "RV dump station sanitary dump",
        latitude, longitude, radius_meters
    )
    
    return PlacesSearchResponse(results=results[:15], total=len(results))

@api_router.get("/boondocking/groceries", response_model=PlacesSearchResponse)
async def find_grocery_stores(latitude: float, longitude: float, radius_miles: int = 20):
    """Find grocery stores (last chance supplies)."""
    radius_meters = int(radius_miles * 1609.34)
    
    results = await search_google_places(
        latitude, longitude,
        place_type="supermarket",
        radius_meters=radius_meters
    )
    
    return PlacesSearchResponse(results=results[:15], total=len(results))

@api_router.get("/boondocking/rv-dealers", response_model=PlacesSearchResponse)
async def find_rv_dealers(latitude: float, longitude: float, radius_miles: int = 50):
    """Find RV dealerships for repairs and parts."""
    radius_meters = int(radius_miles * 1609.34)
    
    results = await search_places_text(
        "RV dealer RV sales RV service",
        latitude, longitude, radius_meters
    )
    
    return PlacesSearchResponse(results=results[:15], total=len(results))

@api_router.post("/boondocking/solar-forecast", response_model=SolarForecastResponse)
async def calculate_solar_forecast(request: SolarForecastRequest):
    """Calculate solar power forecast based on weather and panel specs."""
    
    # Get weather data for location
    weather = await get_noaa_weather(request.latitude, request.longitude)
    location_name = await reverse_geocode(request.latitude, request.longitude) or "Unknown Location"
    
    # Default values if weather unavailable
    cloud_cover = 20
    sunrise = "6:30 AM"
    sunset = "6:30 PM"
    daylight_hours = 12.0
    
    if weather:
        sunrise = weather.sunrise or sunrise
        sunset = weather.sunset or sunset
        
        # Estimate cloud cover from conditions
        conditions = (weather.conditions or "").lower()
        if "clear" in conditions or "sunny" in conditions:
            cloud_cover = 10
        elif "partly" in conditions:
            cloud_cover = 40
        elif "mostly cloudy" in conditions:
            cloud_cover = 70
        elif "cloudy" in conditions or "overcast" in conditions:
            cloud_cover = 85
        elif "rain" in conditions or "storm" in conditions:
            cloud_cover = 90
    
    # Calculate expected sun hours (affected by clouds)
    sun_efficiency = (100 - cloud_cover) / 100
    expected_sun_hours = daylight_hours * sun_efficiency * 0.7  # 0.7 factor for peak sun hours
    
    # Calculate production (panel watts * peak sun hours)
    estimated_production = request.panel_watts * expected_sun_hours
    
    # Net energy
    net_energy = estimated_production - request.daily_consumption_wh
    
    # Battery charge calculation (assuming 12V system)
    battery_wh = request.battery_capacity_ah * 12
    charge_percent = min(100, max(0, ((battery_wh + net_energy) / battery_wh) * 100))
    
    # Generate recommendation
    if net_energy > 500:
        recommendation = "☀️ Excellent solar day! You'll have surplus energy to fully charge batteries."
    elif net_energy > 0:
        recommendation = "👍 Good solar production expected. Should meet your daily needs."
    elif net_energy > -500:
        recommendation = "⚠️ Marginal solar day. Consider reducing consumption or running generator."
    else:
        recommendation = "🔌 Poor solar conditions. Plan to use generator or shore power for charging."
    
    return SolarForecastResponse(
        location=location_name,
        forecast_date=datetime.now().strftime("%Y-%m-%d"),
        sunrise=sunrise,
        sunset=sunset,
        daylight_hours=daylight_hours,
        cloud_cover_percent=cloud_cover,
        expected_sun_hours=round(expected_sun_hours, 1),
        estimated_production_wh=round(estimated_production, 0),
        consumption_wh=request.daily_consumption_wh,
        net_energy_wh=round(net_energy, 0),
        battery_charge_percent=round(charge_percent, 0),
        recommendation=recommendation
    )

@api_router.post("/boondocking/propane-usage", response_model=PropaneUsageResponse)
async def calculate_propane_usage(request: PropaneUsageRequest):
    """Calculate propane usage based on BTU ratings and weather."""
    
    # Get weather for temperature forecast
    weather = await get_noaa_weather(request.latitude, request.longitude)
    location_name = await reverse_geocode(request.latitude, request.longitude) or "Unknown Location"
    
    current_temp = 50
    low_temp = 35
    
    if weather:
        current_temp = weather.temperature or current_temp
        # Estimate low temp as 15 degrees below current
        low_temp = current_temp - 15
    
    # Calculate heating needs (hours when temp below 65°F comfort zone)
    comfort_temp = 65
    if low_temp < comfort_temp:
        # Estimate heating hours based on temp difference
        temp_diff = comfort_temp - low_temp
        heating_hours = min(12, temp_diff / 3)  # More hours needed for bigger temp gaps
    else:
        heating_hours = 0
    
    # Propane BTU content: ~91,500 BTU per gallon
    BTU_PER_GALLON = 91500
    
    # Calculate daily propane usage
    heating_btu = request.heater_btu * heating_hours * 0.5  # 50% duty cycle assumed
    cooking_btu = 10000 * request.cooking_hours_per_day  # ~10k BTU for cooking
    water_heater_btu = request.water_heater_btu * 1  # 1 hour water heating per day
    
    total_daily_btu = heating_btu + cooking_btu + water_heater_btu
    daily_propane_gallons = total_daily_btu / BTU_PER_GALLON
    
    # Days until empty
    days_until_empty = request.tank_size_gallons / daily_propane_gallons if daily_propane_gallons > 0 else 999
    
    # Generate recommendation
    if days_until_empty > 14:
        recommendation = "✅ Propane supply is good for extended boondocking."
    elif days_until_empty > 7:
        recommendation = "👍 Adequate propane for about a week. Plan refill soon."
    elif days_until_empty > 3:
        recommendation = "⚠️ Propane getting low. Find refill station within a few days."
    else:
        recommendation = "🔴 Critical! Refill propane immediately."
    
    return PropaneUsageResponse(
        location=location_name,
        current_temp=current_temp,
        low_temp=low_temp,
        heating_hours_needed=round(heating_hours, 1),
        daily_propane_gallons=round(daily_propane_gallons, 2),
        days_until_empty=round(days_until_empty, 1),
        recommendation=recommendation
    )

@api_router.post("/boondocking/wind-shelter", response_model=WindShelterResponse)
async def calculate_wind_shelter(request: WindShelterRequest):
    """Calculate RV orientation recommendations for wind protection."""
    
    weather = await get_noaa_weather(request.latitude, request.longitude)
    location_name = await reverse_geocode(request.latitude, request.longitude) or "Unknown Location"
    
    wind_speed = 0
    wind_direction = "N"
    wind_gust = None
    
    if weather:
        # Parse wind speed
        wind_str = weather.wind_speed or "0 mph"
        try:
            wind_speed = int(''.join(filter(str.isdigit, wind_str.split()[0])))
        except:
            wind_speed = 0
        wind_direction = weather.wind_direction or "N"
    
    # Calculate recommended orientation (nose into wind for aerodynamics)
    direction_map = {
        "N": "South", "NE": "Southwest", "E": "West", "SE": "Northwest",
        "S": "North", "SW": "Northeast", "W": "East", "NW": "Southeast",
        "NNE": "South-Southwest", "ENE": "West-Southwest", "ESE": "West-Northwest",
        "SSE": "North-Northwest", "SSW": "North-Northeast", "WSW": "East-Northeast",
        "WNW": "East-Southeast", "NNW": "South-Southeast"
    }
    
    recommended = direction_map.get(wind_direction, "South")
    
    # Calculate shelter score (100 = no wind issues)
    if wind_speed < 10:
        shelter_score = 100
    elif wind_speed < 20:
        shelter_score = 80
    elif wind_speed < 30:
        shelter_score = 50
    else:
        shelter_score = 20
    
    # Generate tips
    tips = []
    if wind_speed > 30:
        tips.append("⚠️ High winds - consider relocating to a sheltered area")
        tips.append("Lower all awnings and secure loose items")
        tips.append("Park alongside buildings or terrain for windbreak")
    elif wind_speed > 20:
        tips.append("Retract awnings when not supervised")
        tips.append("Point nose into wind to reduce sway")
        tips.append("Use wheel chocks and stabilizers")
    elif wind_speed > 10:
        tips.append("Good conditions - awnings safe with monitoring")
        tips.append(f"Orient RV facing {recommended} for best stability")
    else:
        tips.append("✅ Calm conditions - no wind concerns")
        tips.append("Great day for outdoor activities")
    
    return WindShelterResponse(
        location=location_name,
        wind_speed_mph=wind_speed,
        wind_direction=wind_direction,
        wind_gust_mph=wind_gust,
        recommended_orientation=f"Face {recommended} (nose into {wind_direction} wind)",
        shelter_score=shelter_score,
        tips=tips
    )

@api_router.get("/boondocking/connectivity", response_model=ConnectivityResponse)
async def check_connectivity(latitude: float, longitude: float):
    """Check cell connectivity estimates for major carriers."""
    
    location_name = await reverse_geocode(latitude, longitude) or "Unknown Location"
    
    # Get population density estimate based on reverse geocode
    # Urban areas = better signal, rural = worse
    is_urban = any(term in location_name.lower() for term in ["city", "town", "village", "metro"])
    
    # Base signal estimation (in real app, would use actual coverage APIs)
    # This provides reasonable estimates based on carrier coverage patterns
    
    if is_urban:
        base_signal = 4
    else:
        # Check if near major highways or populated areas
        base_signal = 2
    
    carriers = [
        {
            "name": "Verizon",
            "signal_bars": min(5, base_signal + 1),  # Verizon typically best rural coverage
            "signal_strength": "Good" if base_signal >= 3 else "Fair" if base_signal >= 2 else "Weak",
            "lte_available": base_signal >= 2,
            "5g_available": is_urban
        },
        {
            "name": "AT&T", 
            "signal_bars": base_signal,
            "signal_strength": "Good" if base_signal >= 3 else "Fair" if base_signal >= 2 else "Weak",
            "lte_available": base_signal >= 2,
            "5g_available": is_urban
        },
        {
            "name": "T-Mobile",
            "signal_bars": max(1, base_signal - 1),  # T-Mobile typically weaker rural
            "signal_strength": "Good" if base_signal >= 4 else "Fair" if base_signal >= 2 else "Weak",
            "lte_available": base_signal >= 3,
            "5g_available": is_urban
        },
        {
            "name": "Starlink",
            "signal_bars": 4,  # Starlink works almost everywhere with clear sky
            "signal_strength": "Excellent" if not is_urban else "Good",
            "lte_available": False,
            "satellite": True,
            "note": "Requires clear view of sky"
        }
    ]
    
    # Overall rating
    avg_bars = sum(c["signal_bars"] for c in carriers[:3]) / 3
    if avg_bars >= 4:
        overall = "Excellent"
    elif avg_bars >= 3:
        overall = "Good"
    elif avg_bars >= 2:
        overall = "Fair"
    else:
        overall = "Poor"
    
    # Recommendation
    if overall == "Poor":
        recommendation = "📡 Weak cellular coverage. Starlink or cell booster recommended."
    elif overall == "Fair":
        recommendation = "📱 Moderate coverage. Cell booster may improve speeds."
    else:
        recommendation = "✅ Good connectivity. Streaming and video calls should work."
    
    return ConnectivityResponse(
        latitude=latitude,
        longitude=longitude,
        location_name=location_name,
        carriers=carriers,
        overall_rating=overall,
        recommendation=recommendation
    )

@api_router.post("/boondocking/campsite-index", response_model=CampsiteIndexResponse)
async def calculate_campsite_index(request: CampsiteIndexRequest):
    """Calculate campsite suitability index based on multiple factors."""
    
    location_name = await reverse_geocode(request.latitude, request.longitude) or "Unknown Location"
    weather = await get_noaa_weather(request.latitude, request.longitude)
    
    factors = {}
    
    # Wind factor
    wind_speed = 0
    if weather:
        wind_str = weather.wind_speed or "0 mph"
        try:
            wind_speed = int(''.join(filter(str.isdigit, wind_str.split()[0])))
        except:
            wind_speed = 0
    
    if wind_speed < 10:
        factors["wind"] = {"score": 100, "rating": "Excellent", "detail": f"{wind_speed} mph - Calm"}
    elif wind_speed < 20:
        factors["wind"] = {"score": 75, "rating": "Good", "detail": f"{wind_speed} mph - Light breeze"}
    elif wind_speed < 30:
        factors["wind"] = {"score": 50, "rating": "Fair", "detail": f"{wind_speed} mph - Moderate"}
    else:
        factors["wind"] = {"score": 25, "rating": "Poor", "detail": f"{wind_speed} mph - High winds"}
    
    # Weather/conditions factor
    if weather:
        conditions = (weather.conditions or "clear").lower()
        if "clear" in conditions or "sunny" in conditions:
            factors["weather"] = {"score": 100, "rating": "Excellent", "detail": weather.conditions}
        elif "partly" in conditions:
            factors["weather"] = {"score": 80, "rating": "Good", "detail": weather.conditions}
        elif "cloudy" in conditions:
            factors["weather"] = {"score": 60, "rating": "Fair", "detail": weather.conditions}
        elif "rain" in conditions:
            factors["weather"] = {"score": 30, "rating": "Poor", "detail": weather.conditions}
        else:
            factors["weather"] = {"score": 70, "rating": "Good", "detail": weather.conditions or "Unknown"}
    else:
        factors["weather"] = {"score": 70, "rating": "Unknown", "detail": "Weather data unavailable"}
    
    # Cell signal estimate
    is_urban = any(term in location_name.lower() for term in ["city", "town", "village"])
    if is_urban:
        factors["cell_signal"] = {"score": 90, "rating": "Excellent", "detail": "Urban area - strong signal likely"}
    else:
        factors["cell_signal"] = {"score": 50, "rating": "Fair", "detail": "Rural area - signal may be limited"}
    
    # Road access estimate (based on if we could geocode the location)
    if location_name and location_name != "Unknown Location":
        factors["road_access"] = {"score": 80, "rating": "Good", "detail": "Accessible by road"}
    else:
        factors["road_access"] = {"score": 40, "rating": "Unknown", "detail": "Road access unclear"}
    
    # Terrain (simplified estimate)
    factors["terrain"] = {"score": 70, "rating": "Good", "detail": "Terrain assessment requires on-site evaluation"}
    
    # Tree shade (simplified)
    factors["shade"] = {"score": 60, "rating": "Fair", "detail": "Shade availability varies by specific site"}
    
    # Calculate overall score
    overall_score = int(sum(f["score"] for f in factors.values()) / len(factors))
    
    if overall_score >= 80:
        overall_rating = "Excellent"
        recommendation = "✅ Great campsite conditions! This location looks very suitable."
    elif overall_score >= 60:
        overall_rating = "Good"
        recommendation = "👍 Good conditions overall. Check specific factors for any concerns."
    elif overall_score >= 40:
        overall_rating = "Fair"
        recommendation = "⚠️ Some concerns. Review wind and weather before setting up."
    else:
        overall_rating = "Poor"
        recommendation = "🔴 Challenging conditions. Consider finding an alternative site."
    
    return CampsiteIndexResponse(
        latitude=request.latitude,
        longitude=request.longitude,
        location_name=location_name,
        overall_score=overall_score,
        overall_rating=overall_rating,
        factors=factors,
        recommendation=recommendation
    )

# ==================== Trucker API Endpoints ====================

@api_router.get("/trucker/truck-stops", response_model=PlacesSearchResponse)
async def find_truck_stops(latitude: float, longitude: float, radius_miles: int = 30):
    """Find truck stops with fuel."""
    radius_meters = int(radius_miles * 1609.34)
    
    results = await search_places_text(
        "truck stop diesel fuel flying j pilot loves travel center",
        latitude, longitude, radius_meters
    )
    
    return PlacesSearchResponse(results=results[:15], total=len(results))

@api_router.get("/trucker/weigh-stations")
async def find_weigh_stations(latitude: float, longitude: float, radius_miles: int = 50):
    """Find weigh stations along route."""
    
    # Search for weigh stations using Google Places
    radius_meters = int(radius_miles * 1609.34)
    
    results = await search_places_text(
        "weigh station truck scale inspection station",
        latitude, longitude, radius_meters
    )
    
    # Convert to weigh station format
    stations = []
    for r in results[:10]:
        stations.append({
            "name": r.name,
            "location": r.address,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "distance_miles": r.distance_miles,
            "highway": "Check signage",
            "direction": "Both",
            "status": "Check DOT for current status",
            "bypass_available": False  # Would need PrePass API for real data
        })
    
    return {"results": stations, "total": len(stations)}

@api_router.get("/trucker/parking", response_model=PlacesSearchResponse)
async def find_truck_parking(latitude: float, longitude: float, radius_miles: int = 30):
    """Find truck parking locations."""
    radius_meters = int(radius_miles * 1609.34)
    
    results = await search_places_text(
        "truck parking overnight parking semi truck rest area",
        latitude, longitude, radius_meters
    )
    
    return PlacesSearchResponse(results=results[:15], total=len(results))

@api_router.get("/trucker/low-clearance")
async def find_low_clearances(latitude: float, longitude: float, vehicle_height_ft: float = 13.5, radius_miles: int = 20):
    """Find low clearance warnings for trucks."""
    
    # In production, this would use a specialized trucking API or DOT data
    # For now, search for bridges and underpasses that may have restrictions
    radius_meters = int(radius_miles * 1609.34)
    
    results = await search_places_text(
        "underpass bridge overpass tunnel",
        latitude, longitude, radius_meters
    )
    
    clearances = []
    for r in results[:10]:
        # Estimate clearance (in real app, would use DOT database)
        estimated_clearance = 14.0  # Default assumption
        
        warning_level = "safe"
        if estimated_clearance < vehicle_height_ft:
            warning_level = "danger"
        elif estimated_clearance < vehicle_height_ft + 0.5:
            warning_level = "caution"
        
        clearances.append({
            "location": r.name,
            "address": r.address,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "clearance_ft": estimated_clearance,
            "vehicle_height_ft": vehicle_height_ft,
            "distance_miles": r.distance_miles,
            "warning_level": warning_level,
            "note": "Verify clearance with local signage - data is estimated"
        })
    
    return {
        "results": clearances,
        "total": len(clearances),
        "warning": "Always verify clearances with posted signage. This data is estimated."
    }

@api_router.get("/trucker/repair-services", response_model=PlacesSearchResponse)
async def find_truck_repair(latitude: float, longitude: float, radius_miles: int = 30):
    """Find truck repair services."""
    radius_meters = int(radius_miles * 1609.34)
    
    results = await search_places_text(
        "truck repair semi truck service diesel mechanic trailer repair",
        latitude, longitude, radius_meters
    )
    
    return PlacesSearchResponse(results=results[:15], total=len(results))

@api_router.get("/trucker/weight-restrictions")
async def find_weight_restrictions(latitude: float, longitude: float, radius_miles: int = 30):
    """Find weight-restricted routes."""
    
    location_name = await reverse_geocode(latitude, longitude) or "Unknown"
    
    # In production, this would query DOT road restriction databases
    # For now, provide general guidance
    restrictions = [
        {
            "type": "general_info",
            "title": "Federal Weight Limits",
            "description": "Interstate highways: 80,000 lbs GVW max, 20,000 lbs single axle, 34,000 lbs tandem axle",
            "source": "FHWA"
        },
        {
            "type": "seasonal",
            "title": "Spring Thaw Restrictions",
            "description": "Many states impose seasonal weight limits during spring thaw (March-May). Check state DOT.",
            "applies_to": "Northern states"
        },
        {
            "type": "bridge",
            "title": "Bridge Weight Limits",
            "description": "Older bridges may have posted weight limits below federal maximums. Watch for signage.",
            "recommendation": "Plan route using truck GPS with bridge data"
        }
    ]
    
    return {
        "location": location_name,
        "latitude": latitude,
        "longitude": longitude,
        "restrictions": restrictions,
        "recommendation": "Use a commercial truck GPS or routing app for accurate weight restriction data. Check state DOT for current seasonal restrictions."
    }


# ==================== Water Budget API ====================

class WaterBudgetRequest(BaseModel):
    fresh_gal: float = 40
    gray_gal: float = 30
    black_gal: float = 20
    people: int = 2
    showers_per_week: float = 7
    hot_days: bool = False  # Increased water usage in hot weather

class WaterBudgetResponse(BaseModel):
    days_remaining: float
    limiting_factor: str  # "fresh", "gray", or "black"
    daily_fresh_gal: float
    daily_gray_gal: float
    daily_black_gal: float
    fresh_days: float
    gray_days: float
    black_days: float
    advisory: Optional[str] = None

@api_router.post("/water-budget", response_model=WaterBudgetResponse)
async def calculate_water_budget(request: WaterBudgetRequest):
    """Calculate how long water tanks will last based on usage patterns."""
    
    people = max(1, request.people)
    
    # Base daily usage per person (gallons)
    base_drinking = 0.5  # Drinking water
    base_cooking = 1.0   # Cooking/dishes
    base_misc = 0.5      # Hand washing, misc
    
    # Shower usage: 2 gallons per minute, average 5-minute shower
    shower_gallons = 10
    showers_per_day = request.showers_per_week / 7
    daily_shower = showers_per_day * shower_gallons * people
    
    # Toilet usage: 0.5 gallons per flush (composting/low-flow), ~6 flushes per person
    daily_toilet = 0.5 * 6 * people
    
    # Hot weather increases water consumption by 30%
    hot_multiplier = 1.3 if request.hot_days else 1.0
    
    # Calculate daily usage
    daily_fresh = ((base_drinking + base_cooking + base_misc) * people + daily_shower) * hot_multiplier
    daily_gray = daily_shower + (base_cooking * people * 0.8)  # 80% of cooking water goes to gray
    daily_black = daily_toilet
    
    # Calculate days for each tank
    fresh_days = request.fresh_gal / daily_fresh if daily_fresh > 0 else 999
    gray_days = request.gray_gal / daily_gray if daily_gray > 0 else 999
    black_days = request.black_gal / daily_black if daily_black > 0 else 999
    
    # Find limiting factor
    min_days = min(fresh_days, gray_days, black_days)
    
    if min_days == fresh_days:
        limiting_factor = "Fresh water tank"
    elif min_days == gray_days:
        limiting_factor = "Gray water tank"
    else:
        limiting_factor = "Black water tank"
    
    # Generate advisory
    advisory = None
    if min_days < 2:
        advisory = "WARNING: You should find water/dump services soon!"
    elif min_days < 4:
        advisory = "Consider conserving water or planning for a dump station visit."
    elif min_days >= 7:
        advisory = "Good capacity for extended boondocking!"
    
    return WaterBudgetResponse(
        days_remaining=round(min_days, 1),
        limiting_factor=limiting_factor,
        daily_fresh_gal=round(daily_fresh, 1),
        daily_gray_gal=round(daily_gray, 1),
        daily_black_gal=round(daily_black, 1),
        fresh_days=round(fresh_days, 1),
        gray_days=round(gray_days, 1),
        black_days=round(black_days, 1),
        advisory=advisory
    )


# Include the router in the main app
app.include_router(api_router)

# Include auth, subscription, admin, and webhook routers
from routers.auth import router as auth_router
from routers.subscription import router as subscription_router
from routers.admin import router as admin_router
from routers.webhooks import router as webhook_router

app.include_router(auth_router, prefix="/api")
app.include_router(subscription_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(webhook_router, prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint for Render
@app.get("/health")
async def health_check():
    """Health check endpoint for load balancer"""
    return {"status": "healthy", "service": "routecast-api"}

@app.on_event("startup")
async def startup_db_client():
    """Store database in app state for access in routers"""
    app.state.db = db

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
