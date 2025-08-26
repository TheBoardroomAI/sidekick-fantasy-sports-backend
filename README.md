# SideKick Fantasy Sports Backend

Production-ready Firebase Functions backend for the SideKick Fantasy Sports application.

## 🏆 Overview

This repository contains the complete backend implementation for SideKick Fantasy Sports, featuring:

- **6 AI Personas** with unique personalities and voice integration
- **Real-time Draft Rooms** with Pusher integration
- **Comprehensive Sports Data** integration (Tank01, MySportsFeeds, nflverse)
- **Stripe Subscription System** with 3-tier access control
- **Voice Processing** with ElevenLabs TTS
- **Zane AI Sports Reporter** with breaking news and analysis

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Firebase CLI
- Firebase project with Functions enabled

### Installation
```bash
# Clone the repository
git clone https://github.com/TheBoardroomAI/sidekick-fantasy-sports-backend.git
cd sidekick-fantasy-sports-backend

# Install dependencies
cd functions
npm install

# Deploy to Firebase
firebase deploy --only functions
```

## 🏗️ Architecture

### Core Services
- **Authentication Service** - Firebase Auth integration with JWT tokens
- **Subscription Service** - Stripe integration with webhook validation
- **Data Integration Service** - Sports data APIs with caching
- **Voice System** - ElevenLabs TTS with persona voices
- **Real-time Service** - Pusher integration for live features
- **Persona Engine** - AI conversation system with GPT-4
- **Zane Reporter** - AI sports news and analysis

### Security Features
- **Rate Limiting** - Multi-tier rate limiting system
- **Input Validation** - Comprehensive XSS and injection protection
- **Subscription Enforcement** - Tier-based access control
- **Firestore Security Rules** - Database-level security
- **Error Boundaries** - Graceful error handling

### Performance Optimizations
- **Cold Start Mitigation** - Warm instances and function optimization
- **Multi-layer Caching** - Memory + Firestore caching system
- **Memory Management** - Automatic cleanup and leak prevention
- **Database Optimization** - Composite indexes and efficient queries

## 📁 Project Structure

```
sidekick-firebase-backend/
├── functions/
│   ├── src/
│   │   ├── config/          # Firebase and Stripe configuration
│   │   ├── middleware/      # Authentication, rate limiting, validation
│   │   ├── models/          # Data models and interfaces
│   │   ├── routes/          # API route handlers
│   │   ├── services/        # Core business logic services
│   │   └── index.ts         # Main Firebase Functions entry point
│   ├── package.json         # Dependencies and scripts
│   └── tsconfig.json        # TypeScript configuration
├── firebase.json            # Firebase project configuration
├── firestore.rules          # Firestore security rules
├── firestore.indexes.json   # Database indexes
└── README.md               # This file
```

## 🔧 Configuration

### Environment Variables
Set these in Firebase Functions configuration:

```bash
# API Keys
firebase functions:config:set tank01.api_key="your_tank01_key"
firebase functions:config:set mysportsfeeds.api_key="your_msf_key"
firebase functions:config:set elevenlabs.api_key="your_elevenlabs_key"
firebase functions:config:set openai.api_key="your_openai_key"

# Stripe
firebase functions:config:set stripe.secret_key="your_stripe_secret"
firebase functions:config:set stripe.webhook_secret="your_webhook_secret"

# Pusher
firebase functions:config:set pusher.app_id="your_pusher_app_id"
firebase functions:config:set pusher.key="your_pusher_key"
firebase functions:config:set pusher.secret="your_pusher_secret"
```

## 🎭 AI Personas

### Available Personas
1. **The Rookie** - Enthusiastic beginner-friendly advice
2. **The Mentor** - Patient, educational guidance
3. **The Analyst** - Data-driven statistical analysis
4. **The Oracle** - Mystical trend predictions
5. **The Rebel** - Bold, contrarian strategies
6. **Zane AI Reporter** - Professional sports news and analysis

### Subscription Tiers
- **Rookie Tier** - Access to Rookie and Mentor personas
- **Pro Tier** - Access to all personas except Zane, voice features, draft rooms
- **Champion Tier** - Full access to all features including Zane AI Reporter

## 🔌 API Endpoints

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/refresh` - Token refresh

### Personas
- `POST /persona/{personaId}/chat` - Chat with AI persona
- `POST /persona/{personaId}/voice` - Voice interaction
- `GET /persona/{personaId}/config` - Get persona configuration

### Data
- `GET /data/players` - Get player data
- `GET /data/rankings` - Get player rankings
- `GET /data/matchups` - Get matchup analysis

### Subscriptions
- `POST /webhook/stripe` - Stripe webhook handler
- `POST /subscription/checkout` - Create checkout session
- `GET /subscription/status` - Get subscription status

### Real-time
- `POST /realtime/draft-room` - Create draft room
- `POST /realtime/join` - Join draft room
- `GET /realtime/status` - Get room status

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Lint code
npm run lint

# Build TypeScript
npm run build
```

## 📊 Monitoring

The backend includes comprehensive monitoring:

- **Performance Metrics** - Response times, memory usage, function invocations
- **Error Tracking** - Automatic error logging and alerting
- **Cache Statistics** - Hit rates and performance metrics
- **Security Monitoring** - Rate limiting and authentication failures

## 🔒 Security

### Implemented Security Measures
- **Input Validation** - XSS and injection protection
- **Rate Limiting** - Prevents API abuse
- **Authentication** - JWT token validation
- **Subscription Enforcement** - Tier-based access control
- **Firestore Rules** - Database-level security
- **Webhook Validation** - Cryptographic signature verification

## 📈 Performance

### Optimizations
- **Cold Start Mitigation** - Sub-2 second response times
- **Caching Strategy** - Multi-layer caching system
- **Memory Management** - Automatic cleanup and monitoring
- **Database Optimization** - Efficient queries and indexes

### Performance Targets
- **Response Time** - < 2 seconds for all endpoints
- **Uptime** - 99.9% availability
- **Memory Usage** - < 512MB per function instance
- **Cache Hit Rate** - > 80% for frequently accessed data

## 🚀 Deployment

### Production Deployment
```bash
# Deploy all functions
firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:functionName

# Deploy with specific project
firebase use production
firebase deploy --only functions
```

### Staging Deployment
```bash
firebase use staging
firebase deploy --only functions
```

## 📝 Documentation

- [Deployment Guide](DEPLOYMENT_GUIDE.md) - Complete deployment instructions
- [Frontend Integration Guide](FRONTEND_INTEGRATION_GUIDE.md) - Frontend integration details
- [API Documentation](docs/api.md) - Detailed API reference
- [Security Guide](docs/security.md) - Security implementation details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is proprietary software owned by SideKick Fantasy Sports.

## 🆘 Support

For support and questions:
- Create an issue in this repository
- Contact the development team
- Check the documentation in the `docs/` directory

---

**Built with ❤️ by the SideKick Fantasy Sports Team**

