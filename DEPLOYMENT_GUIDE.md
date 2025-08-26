# SideKick Fantasy Sports - Firebase Functions Deployment Guide

## 🎯 Overview

This guide provides complete instructions for deploying the SideKick Fantasy Sports Firebase Functions backend to production.

## 📋 Prerequisites

### Required Accounts & Services
- Firebase Project: `sidekicksportsapp-02823395`
- Stripe Account (for subscription management)
- ElevenLabs Account (for voice generation)
- Pusher Account (for real-time features)
- Tank01 API Subscription ($25/month ULTRA plan)
- MySportsFeeds API Subscription ($39/month plan)
- OpenAI API Account (for GPT-4 access)

### Required Tools
- Node.js 18+ 
- Firebase CLI (`npm install -g firebase-tools`)
- Git

## 🔧 Environment Setup

### 1. Firebase Configuration

```bash
# Login to Firebase
firebase login

# Set project
firebase use sidekicksportsapp-02823395

# Verify project
firebase projects:list
```

### 2. API Keys Configuration

Set up Firebase Secret Manager with the following keys:

```bash
# Stripe Configuration
firebase functions:config:set stripe.secret_key="sk_live_..."
firebase functions:config:set stripe.webhook_secret="whsec_..."

# ElevenLabs Configuration  
firebase functions:config:set elevenlabs.api_key="your_elevenlabs_key"

# Pusher Configuration
firebase functions:config:set pusher.app_id="your_app_id"
firebase functions:config:set pusher.key="your_key"
firebase functions:config:set pusher.secret="your_secret"
firebase functions:config:set pusher.cluster="us2"

# Sports Data APIs
firebase functions:config:set tank01.api_key="your_tank01_key"
firebase functions:config:set mysportsfeeds.api_key="your_mysportsfeeds_key"

# OpenAI Configuration
firebase functions:config:set openai.api_key="sk-..."

# Zane Reporter API Key (for webhook access)
firebase functions:config:set zane.api_key="your_secure_api_key"
```

### 3. Service Account Setup

The service account JSON file is already configured:
- File: `sidekickfantasysports-ef69ecf043da.json`
- Project ID: `sidekicksportsapp-02823395`

## 🚀 Deployment Steps

### 1. Build the Project

```bash
cd /home/ubuntu/sidekick-firebase-backend/functions
npm install
npm run build
```

### 2. Deploy to Firebase

```bash
# Deploy all functions
firebase deploy --only functions

# Or deploy specific functions
firebase deploy --only functions:auth
firebase deploy --only functions:data
firebase deploy --only functions:persona
firebase deploy --only functions:zane
firebase deploy --only functions:realtime
```

### 3. Verify Deployment

```bash
# Check function status
firebase functions:log

# Test health check
curl https://us-central1-sidekicksportsapp-02823395.cloudfunctions.net/healthCheck
```

## 🔗 API Endpoints

### Base URL
```
https://us-central1-sidekicksportsapp-02823395.cloudfunctions.net
```

### Available Endpoints

#### Authentication (`/auth`)
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `GET /auth/profile` - Get user profile
- `PUT /auth/profile` - Update user profile
- `POST /auth/subscribe` - Create Stripe subscription
- `GET /auth/subscription` - Get subscription status
- `POST /auth/webhook/stripe` - Stripe webhook handler

#### Data Integration (`/data`)
- `GET /data/player/:playerId` - Get player data
- `GET /data/players` - Get all players
- `GET /data/teams` - Get team data
- `GET /data/games` - Get game data
- `GET /data/stats/players` - Get player stats
- `GET /data/standings` - Get team standings
- `GET /data/metrics/advanced` - Get advanced metrics
- `GET /data/metrics/epa` - Get EPA data
- `GET /data/trending` - Get trending players
- `GET /data/health` - Data sources health check

#### AI Personas (`/persona`)
- `POST /persona/chat/:persona` - Chat with AI persona
- `GET /persona/conversation/:conversationId` - Get conversation
- `GET /persona/conversations` - Get user conversations
- `GET /persona/personas` - Get available personas
- `DELETE /persona/conversation/:conversationId` - Delete conversation
- `GET /persona/stats` - Get persona usage stats

#### Zane AI Reporter (`/zane`)
- `GET /zane/briefing` - Get daily briefing
- `GET /zane/breaking-news` - Get breaking news
- `GET /zane/news/:newsId` - Get specific news item
- `POST /zane/analyze-news` - Submit news for analysis
- `POST /zane/live-update` - Generate live game update
- `GET /zane/news/category/:category` - Get news by category
- `GET /zane/high-impact` - Get high-impact news
- `GET /zane/player/:playerName/news` - Get player news
- `GET /zane/voice-briefing` - Get voice briefing

#### Real-Time Features (`/realtime`)
- `POST /realtime/draft-room` - Create draft room
- `POST /realtime/draft-room/:roomId/join` - Join draft room
- `POST /realtime/draft-room/:roomId/start` - Start draft
- `POST /realtime/draft-room/:roomId/pick` - Make draft pick
- `POST /realtime/draft-room/:roomId/message` - Send message
- `GET /realtime/draft-room/:roomId` - Get draft room details
- `GET /realtime/draft-room/:roomId/messages` - Get messages
- `GET /realtime/draft-rooms` - Get user's draft rooms
- `POST /realtime/draft-room/:roomId/leave` - Leave draft room
- `POST /realtime/pusher/auth` - Pusher authentication
- `GET /realtime/health` - Real-time system health

## 🔐 Authentication

All protected endpoints require Bearer token authentication:

```bash
# Using Firebase ID Token
curl -H "Authorization: Bearer <firebase_id_token>" \
  https://us-central1-sidekicksportsapp-02823395.cloudfunctions.net/persona/chat/oracle

# Using API Token (from login response)
curl -H "Authorization: Bearer <api_token>" \
  https://us-central1-sidekicksportsapp-02823395.cloudfunctions.net/data/players
```

## 🎭 AI Personas

### Available Personas by Subscription Tier

#### Rookie Tier (Free)
- **The Rookie** - Enthusiastic, learning-focused persona

#### Pro Tier ($9.99/month)
- **The Rookie** - Enthusiastic, learning-focused persona
- **The Oracle** - Mystical, pattern-recognizing advisor
- **The Rebel** - Contrarian, value-finding strategist  
- **The Mentor** - Patient, educational guide

#### Champion Tier ($19.99/month)
- All Pro tier personas plus:
- **The Analyst** - Data-driven, statistical expert
- **Zane the AI Sports Reporter** - Breaking news and analysis

## 🎤 Voice Features

### ElevenLabs Integration
- Custom voice for each persona
- Automatic voice generation for responses
- Voice caching for performance
- Subscription tier-based access

### Voice Endpoints
- Voice responses included in persona chat
- Daily voice briefings from Zane
- Breaking news voice alerts

## ⚡ Real-Time Features

### Pusher Integration
- Live draft rooms
- Real-time messaging
- Live game updates
- Breaking news alerts

### Channel Structure
- `draft-room-{roomId}` - Draft room events
- `breaking-news` - Urgent news alerts
- `daily-briefing` - Daily briefing notifications
- `game-{gameId}` - Live game updates

## 📊 Data Sources

### Tank01 API ($25/month ULTRA)
- Live player data
- Real-time game statistics
- Team information
- Performance metrics

### MySportsFeeds API ($39/month)
- Historical player stats
- Team standings
- Advanced analytics
- Season data

### NFLverse API (Free)
- Advanced metrics (EPA, YPRR)
- Play-by-play data
- Efficiency statistics
- Air yards data

## 🔧 Monitoring & Maintenance

### Health Checks
- `/healthCheck` - Overall system health
- `/data/health` - Data sources status
- `/realtime/health` - Real-time system status

### Logging
```bash
# View function logs
firebase functions:log

# View specific function logs
firebase functions:log --only auth
firebase functions:log --only persona
```

### Error Monitoring
- Firebase Functions automatically logs errors
- Stripe webhook events are logged
- API rate limits are monitored

## 🚨 Troubleshooting

### Common Issues

#### 1. API Key Configuration
```bash
# Check current config
firebase functions:config:get

# Update specific key
firebase functions:config:set stripe.secret_key="new_key"
firebase deploy --only functions
```

#### 2. CORS Issues
All functions include CORS headers. If issues persist:
- Verify frontend origin is allowed
- Check preflight OPTIONS handling

#### 3. Authentication Errors
- Verify Firebase ID token is valid
- Check user subscription status
- Ensure API token hasn't expired

#### 4. Voice Generation Failures
- Check ElevenLabs API quota
- Verify voice IDs are configured
- Monitor voice cache storage

#### 5. Real-Time Connection Issues
- Verify Pusher credentials
- Check channel authentication
- Monitor connection limits

## 📈 Performance Optimization

### Caching Strategy
- Player data cached for 1 hour
- Voice responses cached for 7 days
- News items cached until expiration

### Rate Limiting
- API calls are optimized for cost
- Voice generation uses intelligent caching
- Data requests are batched when possible

## 🔄 Updates & Maintenance

### Deploying Updates
```bash
# Build and deploy
npm run build
firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:persona
```

### Database Maintenance
- Firestore automatically scales
- Clean up expired cache entries
- Monitor storage usage

### API Key Rotation
```bash
# Update API keys
firebase functions:config:set stripe.secret_key="new_key"
firebase deploy --only functions
```

## 📞 Support

### Firebase Console
- https://console.firebase.google.com/project/sidekicksportsapp-02823395

### Function URLs
- Base: `https://us-central1-sidekicksportsapp-02823395.cloudfunctions.net`
- Health: `https://us-central1-sidekicksportsapp-02823395.cloudfunctions.net/healthCheck`

### Monitoring
- Firebase Functions dashboard
- Stripe dashboard for payments
- ElevenLabs dashboard for voice usage
- Pusher dashboard for real-time metrics

---

## ✅ Deployment Checklist

- [ ] Firebase CLI installed and authenticated
- [ ] All API keys configured in Firebase Secret Manager
- [ ] Service account JSON file in place
- [ ] Dependencies installed (`npm install`)
- [ ] Project builds successfully (`npm run build`)
- [ ] Functions deployed (`firebase deploy --only functions`)
- [ ] Health check endpoint responding
- [ ] Authentication flow tested
- [ ] Subscription system verified
- [ ] Voice generation working
- [ ] Real-time features operational
- [ ] Data integration confirmed

**🎉 Your SideKick Fantasy Sports backend is ready for production!**

