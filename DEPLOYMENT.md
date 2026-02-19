# RouteCast Production Deployment Guide

## 1. DNS Configuration for Namecheap

Add these records in **Namecheap Advanced DNS**:

### For `app.routecastweather.com` (Frontend)

| Type  | Host | Value | TTL |
|-------|------|-------|-----|
| CNAME | app  | [your-render-frontend-app].onrender.com | Automatic |

### For `api.routecastweather.com` (Backend)

| Type  | Host | Value | TTL |
|-------|------|-------|-----|
| CNAME | api  | [your-render-backend-app].onrender.com | Automatic |

**Note:** Replace `[your-render-frontend-app]` and `[your-render-backend-app]` with your actual Render.com service names. For example:
- `routecast-frontend.onrender.com`
- `routecast-api.onrender.com`

---

## 2. Render.com Deployment

### Backend Service (api.routecastweather.com)

Create a new **Web Service** on Render:

1. **Name:** `routecast-api`
2. **Environment:** Python 3.11
3. **Build Command:** `pip install -r requirements.txt`
4. **Start Command:** `uvicorn server:app --host 0.0.0.0 --port $PORT`
5. **Custom Domain:** `api.routecastweather.com`

**Environment Variables:**
```
MONGO_URL=<your-mongodb-atlas-url>
DB_NAME=routecast
MAPBOX_ACCESS_TOKEN=<your-mapbox-token>
GOOGLE_API_KEY=<your-google-api-key>
NOAA_USER_AGENT=Routecast/1.0 (support@routecast.com)
JWT_SECRET_KEY=<generate-a-strong-secret-key>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
APP_URL=https://app.routecastweather.com
API_URL=https://api.routecastweather.com
SENDGRID_API_KEY=<your-sendgrid-key>
SENDER_EMAIL=noreply@routecastweather.com
STRIPE_API_KEY=<your-stripe-secret-key>
STRIPE_WEBHOOK_SECRET=<your-stripe-webhook-secret>
ADMIN_API_KEY=<generate-admin-key>
```

### Frontend Service (app.routecastweather.com)

Create a new **Static Site** on Render:

1. **Name:** `routecast-app`
2. **Build Command:** `yarn install && yarn build`
3. **Publish Directory:** `dist` (or `build` for Expo)
4. **Custom Domain:** `app.routecastweather.com`

**Environment Variables:**
```
EXPO_PUBLIC_BACKEND_URL=https://api.routecastweather.com
```

---

## 3. API Endpoints Reference

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/login` | Login with email/password |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/verify-email` | Verify email with token |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password with token |
| GET | `/api/auth/me` | Get current user + subscription |

### Subscription

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/subscription/status` | Get subscription status |
| GET | `/api/subscription/plans` | Get available plans |
| POST | `/api/subscription/start-trial` | Start 7-day trial |
| POST | `/api/subscription/checkout` | Create Stripe checkout |
| GET | `/api/subscription/checkout/status/{session_id}` | Check checkout status |
| POST | `/api/subscription/verify/apple` | Verify Apple receipt |
| POST | `/api/subscription/verify/google` | Verify Google receipt |

### Admin (requires X-Admin-Key header)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | List all users |
| GET | `/api/admin/users/{user_id}` | Get user details |
| POST | `/api/admin/users/{user_id}/grant-subscription` | Grant subscription |
| POST | `/api/admin/users/{user_id}/revoke-subscription` | Revoke subscription |
| GET | `/api/admin/stats` | Platform statistics |

### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhook/stripe` | Stripe webhooks |
| POST | `/api/webhook/apple` | Apple notifications |
| POST | `/api/webhook/google` | Google notifications |

---

## 4. Stripe Setup

### Create Products & Prices

1. Go to Stripe Dashboard → Products
2. Create products:
   - **Monthly Plan** - $9.99/month with 7-day trial
   - **Yearly Plan** - $59.99/year with 7-day trial

3. Configure webhook endpoint:
   - URL: `https://api.routecastweather.com/api/webhook/stripe`
   - Events: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`

### Test Cards
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`

---

## 5. Apple In-App Purchase Setup

### App Store Connect

1. Create In-App Purchase products:
   - `com.routecast.monthly` - $9.99/month
   - `com.routecast.yearly` - $59.99/year

2. Configure Server Notifications:
   - URL: `https://api.routecastweather.com/api/webhook/apple`
   - Version: V2

### Backend Configuration

Add to environment:
```
APPLE_SHARED_SECRET=<from-app-store-connect>
APPLE_BUNDLE_ID=com.routecast.app
```

---

## 6. Google Play Billing Setup

### Play Console

1. Create subscriptions:
   - `routecast_monthly` - $9.99/month
   - `routecast_yearly` - $59.99/year

2. Configure Real-time Developer Notifications (RTDN):
   - Topic: `projects/<your-project>/topics/routecast-billing`
   - Push URL: `https://api.routecastweather.com/api/webhook/google`

### Backend Configuration

Add to environment:
```
GOOGLE_SERVICE_ACCOUNT_JSON=<service-account-credentials>
GOOGLE_PACKAGE_NAME=com.routecast.app
```

---

## 7. Entitlements System

### Free Tier
- `basic_route_weather` - Basic route forecasts
- `limited_alerts` - Max 1 route monitor

### Premium Tier (Monthly/Yearly)
- All free features PLUS:
- `unlimited_alerts` - Unlimited route monitors
- `route_monitoring` - Real-time monitoring
- `push_notifications` - Weather alerts
- `ai_assistant` - AI recommendations
- `advanced_weather` - Extended forecasts
- `truck_features` - Bridge clearances, etc.
- `boondocking_features` - Campsite tools
- `export_routes` - Export functionality

### Yearly Bonus
- `priority_support` - Priority customer support

---

## 8. Testing the System

### Test Signup & Login
```bash
# Signup
curl -X POST https://api.routecastweather.com/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'

# Login
curl -X POST https://api.routecastweather.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Test Subscription
```bash
# Get current user (use token from login)
curl https://api.routecastweather.com/api/auth/me \
  -H "Authorization: Bearer <access_token>"

# Start trial
curl -X POST https://api.routecastweather.com/api/subscription/start-trial \
  -H "Authorization: Bearer <access_token>"
```

### Admin Operations
```bash
# List users
curl https://api.routecastweather.com/api/admin/users \
  -H "X-Admin-Key: <admin_api_key>"

# Grant subscription
curl -X POST https://api.routecastweather.com/api/admin/users/<user_id>/grant-subscription \
  -H "X-Admin-Key: <admin_api_key>" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"<user_id>","plan":"yearly","duration_days":365,"reason":"VIP customer"}'
```

---

## 9. Security Checklist

- [ ] Generate strong `JWT_SECRET_KEY` (32+ chars)
- [ ] Generate strong `ADMIN_API_KEY`
- [ ] Use production Stripe keys
- [ ] Configure Stripe webhook signing secret
- [ ] Enable HTTPS only (Render handles this)
- [ ] Set up MongoDB Atlas with IP whitelist
- [ ] Configure SendGrid domain authentication
- [ ] Test all authentication flows
- [ ] Test subscription flows end-to-end

---

## 10. Monitoring

### Logs
- Render Dashboard → Service → Logs

### Metrics
- `/api/admin/stats` - User & subscription counts
- Stripe Dashboard - Payment metrics
- SendGrid - Email deliverability

---

## Questions?

Contact: support@routecast.com
