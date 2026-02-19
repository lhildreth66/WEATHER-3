# RouteCast Render Deployment Checklist

## Quick Start (5 minutes)

### Step 1: Push Code to GitHub
Use the "Save to Github" feature in Emergent to push to your `Routecast2` repo.

### Step 2: Create Backend Service on Render

1. Go to [render.com](https://render.com) → New → Web Service
2. Connect your GitHub repo
3. Configure:
   - **Name:** `routecast-api`
   - **Root Directory:** `backend`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn server:app --host 0.0.0.0 --port $PORT`
   - **Plan:** Starter ($7/month) or higher

4. Add Environment Variables (from `.env.production.template`):
   ```
   MONGO_URL=<your-mongodb-atlas-url>
   DB_NAME=routecast
   JWT_SECRET_KEY=<generate: openssl rand -hex 32>
   SENDGRID_API_KEY=<your-key>
   STRIPE_API_KEY=<your-key>
   ADMIN_API_KEY=<generate: openssl rand -hex 24>
   ... (see template for full list)
   ```

5. Click **Create Web Service**

### Step 3: Create Frontend Service on Render

1. New → Static Site
2. Connect same repo
3. Configure:
   - **Name:** `routecast-app`
   - **Root Directory:** `frontend`
   - **Build Command:** `yarn install && yarn build:web`
   - **Publish Directory:** `dist`

4. Add Environment Variable:
   ```
   EXPO_PUBLIC_BACKEND_URL=https://routecast-api.onrender.com
   ```
   (Update this after backend deploys)

5. Click **Create Static Site**

### Step 4: Add Custom Domains

**For Backend (api.routecastweather.com):**
1. Go to backend service → Settings → Custom Domains
2. Add `api.routecastweather.com`
3. Copy the CNAME target shown (e.g., `routecast-api.onrender.com`)

**For Frontend (app.routecastweather.com):**
1. Go to frontend service → Settings → Custom Domains  
2. Add `app.routecastweather.com`
3. Copy the CNAME target shown

### Step 5: Configure DNS in Namecheap

Go to Namecheap → Domain List → routecastweather.com → Advanced DNS

Add these records:

| Type  | Host | Value                          | TTL       |
|-------|------|--------------------------------|-----------|
| CNAME | api  | routecast-api.onrender.com     | Automatic |
| CNAME | app  | routecast-app.onrender.com     | Automatic |

Wait 5-10 minutes for DNS propagation.

### Step 6: Update Frontend Environment

After custom domain is active:
1. Go to frontend service → Environment
2. Update: `EXPO_PUBLIC_BACKEND_URL=https://api.routecastweather.com`
3. Trigger a redeploy

### Step 7: Configure Stripe Webhook

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://api.routecastweather.com/api/webhook/stripe`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the signing secret
5. Add to Render: `STRIPE_WEBHOOK_SECRET=whsec_...`

### Step 8: Test Everything

```bash
# Test health check
curl https://api.routecastweather.com/health

# Test signup
curl -X POST https://api.routecastweather.com/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test1234"}'

# Test subscription plans
curl https://api.routecastweather.com/api/subscription/plans
```

---

## Estimated Costs

| Service | Plan | Cost |
|---------|------|------|
| Render Backend | Starter | $7/month |
| Render Frontend | Free | $0/month |
| MongoDB Atlas | M0 Free | $0/month |
| SendGrid | Free (100/day) | $0/month |
| **Total** | | **$7/month** |

---

## Troubleshooting

### Backend won't start
- Check Render logs for errors
- Verify all required env vars are set
- Ensure `requirements.txt` has all dependencies

### DNS not working
- Wait 10-30 minutes for propagation
- Verify CNAME records are correct (no trailing dots)
- Check Render shows "Certificate issued"

### Stripe webhooks failing
- Verify webhook URL is correct
- Check webhook signing secret matches
- Test with Stripe CLI: `stripe listen --forward-to localhost:8001/api/webhook/stripe`

### Emails not sending
- Verify SendGrid API key
- Check sender email is verified in SendGrid
- Check spam folder

---

## Next Steps After Deployment

1. [ ] Test full signup → email verification → login flow
2. [ ] Test Stripe checkout flow
3. [ ] Create Stripe products (Monthly $9.99, Yearly $59.99)
4. [ ] Configure SendGrid sender authentication
5. [ ] Set up monitoring/alerts in Render
6. [ ] Test on mobile devices
