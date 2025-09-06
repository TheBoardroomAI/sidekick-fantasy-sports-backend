# Sidekick Fantasy Sports Backend

A sophisticated fantasy sports sidekick selection system with personalized AI interactions and comprehensive backend infrastructure.

## 🎯 Features

### Core Functionality
- **Multi-tier Sidekick System**: Free, premium, and pro sidekicks with different capabilities
- **Intelligent Recommendations**: AI-powered sidekick matching based on user preferences
- **Real-time Analytics**: Comprehensive tracking and analytics for user interactions
- **Subscription Management**: Integrated Stripe billing and tier-based access control
- **Voice Integration**: Voice-enabled sidekick interactions for premium users

### NEW: 🎭 PreferredName Personalization
- **Custom Addressing**: Users can set how their sidekick addresses them
- **Smart Validation**: Automatic name validation and sanitization
- **Seamless Integration**: Full backward compatibility with existing systems
- **Real-time Updates**: Dynamic preferred name changes without re-selection

### Security & Performance
- **Firebase Authentication**: Secure user authentication and authorization  
- **Rate Limiting**: Intelligent rate limiting to prevent abuse
- **Input Validation**: Comprehensive request validation and sanitization
- **Caching System**: Optimized performance with intelligent caching
- **Error Handling**: Robust error handling and logging

## 🚀 Quick Start

### Prerequisites
- Node.js v16.0.0+
- Firebase CLI
- TypeScript v4.5.0+
- Firebase project with Firestore enabled

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/TheBoardroomAI/sidekick-fantasy-sports-backend.git
   cd sidekick-fantasy-sports-backend
   ```

2. **Install dependencies**
   ```bash
   cd functions
   npm install
   ```

3. **Configure Firebase**
   ```bash
   firebase login
   firebase use your-project-id
   ```

4. **Deploy functions**
   ```bash
   firebase deploy --only functions
   ```

5. **Run database migration** (for PreferredName support)
   ```bash
   node migrations/add-preferred-name-support.js
   ```

## 📡 API Endpoints

### Sidekick Selection
- `GET /api/sidekicks/available` - Get available sidekicks by tier
- `GET /api/sidekicks/recommended` - Get personalized recommendations  
- `POST /api/sidekicks/select` - Select sidekick (legacy, backward compatible)
- `POST /api/sidekicks/select-with-name` - **NEW**: Select sidekick with preferred name
- `GET /api/sidekicks/current` - Get current selection with preferred name
- `DELETE /api/sidekicks/selection` - Remove current selection

### PreferredName Management  
- `PUT /api/sidekicks/preferred-name` - **NEW**: Update user's preferred name
- Automatic validation and sanitization
- Real-time preference updates

### User Management
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User authentication
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile

### Data & Analytics
- `GET /api/data/teams` - Get sports teams data
- `GET /api/data/players` - Get player statistics  
- `POST /api/analytics/interaction` - Track user interactions

## 🎭 PreferredName Feature

### Overview
The PreferredName feature allows users to personalize their sidekick interactions by specifying how they want to be addressed. This creates a more personal and engaging experience.

### Frontend Integration

#### Basic Usage
```typescript
import { SidekickClient } from './src/sdk/sidekick-client';

const client = new SidekickClient({
  baseURL: 'https://your-api.com',
  authToken: userToken
});

// Select sidekick with preferred name
const selection = await client.selectSidekickWithName({
  sidekickId: 'coach-mike',
  preferredName: 'Alex',
  preferences: {
    notifications: true,
    voiceEnabled: true
  }
});

// Update preferred name later
await client.updatePreferredName('Alexandra');

// Get current selection with preferred name
const current = await client.getCurrentSelection();
console.log(`Sidekick calls you: ${current.selectionData?.preferredName}`);
```

#### React Hook
```typescript
import { useSidekickSelection } from './src/hooks/useSidekickSelection';

function MyComponent() {
  const { 
    currentSelection, 
    selectWithName, 
    updatePreferredName,
    validateName 
  } = useSidekickSelection();

  const handleSelection = async (sidekickId: string, name: string) => {
    const validation = validateName(name);
    if (validation.isValid) {
      await selectWithName(sidekickId, validation.sanitizedName);
    }
  };

  return (
    <div>
      <p>Current name: {currentSelection?.preferredName}</p>
      {/* Your UI components */}
    </div>
  );
}
```

### Validation Rules
- **Length**: 1-50 characters
- **Characters**: Letters, numbers, spaces, hyphens, apostrophes only
- **Format**: Automatic capitalization and whitespace cleanup
- **Real-time**: Client and server-side validation

### Migration
Existing systems are fully backward compatible. See `/docs/migration-guide.md` for detailed migration instructions.

## 🏗️ Architecture

### Backend Structure
```
functions/
├── src/
│   ├── config/          # Firebase and Stripe configuration
│   ├── middleware/      # Authentication, validation, rate limiting
│   ├── models/          # TypeScript interfaces and types
│   ├── routes/          # API endpoint handlers
│   ├── services/        # Business logic and external integrations  
│   └── utils/           # Utility functions and helpers
├── migrations/          # Database migration scripts
└── docs/               # API documentation and guides
```

### Frontend SDK
```
src/
├── sdk/                # Main SDK client
├── types/              # TypeScript type definitions
├── interfaces/         # Interface definitions
└── hooks/              # React hooks for easy integration
```

### Database Collections

#### Users
```json
{
  "uid": "string",
  "email": "string", 
  "preferences": {
    "favoriteTeams": ["string"],
    "selectedPersona": "string",
    "preferredName": "string"  // NEW: User's preferred name
  }
}
```

#### UserSidekickSelections  
```json
{
  "userId": "string",
  "selectedSidekickId": "string", 
  "isActive": boolean,
  "preferredName": "string",  // NEW: Preferred name for sidekick
  "preferences": {
    "notifications": boolean,
    "voiceEnabled": boolean
  }
}
```

## 🔐 Authentication & Security

### Firebase Authentication
- JWT token-based authentication
- Secure user session management
- Role-based access control

### API Security
- Rate limiting on all endpoints
- Input validation and sanitization
- SQL injection prevention
- XSS protection

### Data Privacy
- GDPR compliant data handling
- Encrypted sensitive information
- Secure data transmission (HTTPS)

## 📊 Performance & Monitoring

### Caching Strategy
- Intelligent caching for frequently accessed data
- Cache invalidation on data updates
- Optimized database queries

### Analytics & Logging
- Comprehensive error logging
- User interaction tracking
- Performance monitoring
- Real-time alerts for issues

### Performance Metrics
- Average API response time: <200ms
- 99.9% uptime guarantee  
- Auto-scaling based on demand
- CDN integration for global performance

## 🧪 Testing

### Running Tests
```bash
# Unit tests
npm test

# Integration tests  
npm run test:integration

# E2E tests
npm run test:e2e

# Test with preferred name features
npm run test:preferred-name
```

### Test Coverage
- Unit tests for all business logic
- Integration tests for API endpoints
- End-to-end tests for user workflows
- PreferredName feature test suite

## 📚 Documentation

- [`/docs/preferred-name-api.md`](./docs/preferred-name-api.md) - Complete PreferredName API documentation
- [`/docs/migration-guide.md`](./docs/migration-guide.md) - Migration guide for PreferredName feature
- [`/functions/src/`](./functions/src/) - Inline code documentation
- [`/src/sdk/`](./src/sdk/) - Frontend SDK documentation

## 🔄 Deployment

### Environment Setup
```bash
# Development
firebase use dev-project-id
firebase deploy --only functions

# Staging  
firebase use staging-project-id
firebase deploy --only functions

# Production
firebase use prod-project-id  
firebase deploy --only functions
```

### CI/CD Pipeline
- Automated testing on pull requests
- Staging deployment on merge to develop
- Production deployment on release tags
- Database migration automation

## 🤝 Contributing

### Development Workflow
1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Make changes with tests
4. Commit changes (`git commit -m 'Add amazing feature'`)
5. Push to branch (`git push origin feature/amazing-feature`)
6. Open pull request

### Code Standards
- TypeScript for all new code
- ESLint configuration compliance
- Comprehensive unit tests required
- API documentation for new endpoints

### PreferredName Development
When working with PreferredName features:
- Always validate names on both client and server
- Maintain backward compatibility
- Update relevant documentation
- Include migration scripts if needed

## 📋 Roadmap

### Current Version (v2.1.0)
- ✅ PreferredName personalization system
- ✅ Enhanced validation and sanitization  
- ✅ Backward compatibility maintained
- ✅ Comprehensive migration tools

### Upcoming Features
- 🔄 Advanced personalization preferences
- 🔄 Multi-language sidekick support
- 🔄 Voice tone customization
- 🔄 Enhanced analytics dashboard

### Future Enhancements
- 📅 Machine learning recommendation engine
- 📅 Social features and sidekick sharing
- 📅 Advanced voice synthesis options
- 📅 Mobile app SDK

## 🐛 Issues & Support

### Reporting Issues
- Use GitHub Issues for bug reports
- Include steps to reproduce
- Provide relevant logs and error messages
- Tag with appropriate labels

### Getting Help
- Check documentation first
- Search existing issues
- Join our Discord community
- Contact support for enterprise clients

### PreferredName Specific Issues
Common PreferredName issues:
- Validation errors: Check character requirements
- Migration problems: Run migration script with proper permissions
- Frontend integration: Ensure SDK is properly updated

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Firebase team for excellent backend infrastructure
- Stripe for seamless payment processing  
- OpenAI for AI-powered recommendation algorithms
- Community contributors and beta testers
- Early adopters of the PreferredName feature

---

## Recent Updates

### v2.1.0 - PreferredName Feature Release
- **NEW**: Complete PreferredName personalization system
- **NEW**: Enhanced validation and sanitization utilities
- **NEW**: Backward compatible API endpoints
- **NEW**: Comprehensive migration tools and documentation
- **IMPROVED**: Frontend SDK with new methods and events
- **IMPROVED**: Database schema with optimized indexes
- **IMPROVED**: User experience with personalized interactions

**Migration Required**: Run `node migrations/add-preferred-name-support.js` to enable PreferredName features.

For detailed migration instructions, see [`/docs/migration-guide.md`](./docs/migration-guide.md).

---

**Built with ❤️ by TheBoardroomAI Team**
