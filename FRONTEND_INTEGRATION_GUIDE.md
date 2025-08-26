# SideKick Fantasy Sports - Frontend Integration Guide

## 🎯 Overview

This guide provides complete instructions for integrating the V0.dev frontend with the Firebase Functions backend.

## 🔗 Backend Base URL

```typescript
const API_BASE_URL = "https://us-central1-sidekicksportsapp-02823395.cloudfunctions.net";
```

## 🔐 Authentication Integration

### 1. Firebase Auth Setup

```typescript
// lib/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  projectId: "sidekicksportsapp-02823395",
  // Add other config values
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
```

### 2. Authentication Service

```typescript
// lib/auth.ts
import { auth } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

export class AuthService {
  static async login(email: string, password: string) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await userCredential.user.getIdToken();
    
    // Call backend login endpoint
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    
    const data = await response.json();
    
    // Store API token for subsequent requests
    localStorage.setItem('apiToken', data.apiToken);
    
    return data;
  }
  
  static async register(email: string, password: string, displayName: string) {
    // First register with backend
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, displayName })
    });
    
    const data = await response.json();
    
    // Then create Firebase auth user
    await createUserWithEmailAndPassword(auth, email, password);
    
    return data;
  }
  
  static getAuthHeaders() {
    const token = localStorage.getItem('apiToken');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }
}
```

## 🎭 AI Personas Integration

### 1. Persona Service

```typescript
// lib/personas.ts
export interface Persona {
  id: string;
  name: string;
  personality: string;
  available: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatResponse {
  text: string;
  audio?: string;
  conversationId: string;
  persona: string;
  timestamp: string;
}

export class PersonaService {
  static async getAvailablePersonas(): Promise<Persona[]> {
    const response = await fetch(`${API_BASE_URL}/persona/personas`, {
      headers: AuthService.getAuthHeaders()
    });
    
    const data = await response.json();
    return data.personas;
  }
  
  static async chatWithPersona(
    persona: string, 
    message: string, 
    conversationId?: string
  ): Promise<ChatResponse> {
    const response = await fetch(`${API_BASE_URL}/persona/chat/${persona}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AuthService.getAuthHeaders()
      },
      body: JSON.stringify({ 
        message, 
        conversationId,
        userPreferences: {
          favoriteTeams: ['Chiefs', 'Bills'], // Get from user profile
          riskTolerance: 'moderate',
          experienceLevel: 'intermediate'
        }
      })
    });
    
    const data = await response.json();
    return data.response;
  }
  
  static async getConversations(): Promise<any[]> {
    const response = await fetch(`${API_BASE_URL}/persona/conversations`, {
      headers: AuthService.getAuthHeaders()
    });
    
    const data = await response.json();
    return data.conversations;
  }
}
```

### 2. Chat Component Integration

```typescript
// components/ChatInterface.tsx
import { useState, useEffect } from 'react';
import { PersonaService, ChatResponse } from '../lib/personas';

interface ChatInterfaceProps {
  selectedPersona: string;
}

export function ChatInterface({ selectedPersona }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  
  const sendMessage = async () => {
    if (!input.trim()) return;
    
    const userMessage: ChatMessage = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    try {
      const response = await PersonaService.chatWithPersona(
        selectedPersona,
        input,
        conversationId
      );
      
      setConversationId(response.conversationId);
      
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.text,
        timestamp: response.timestamp
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Play audio if available
      if (response.audio) {
        playAudio(response.audio);
      }
      
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const playAudio = (audioBase64: string) => {
    const audio = new Audio(`data:audio/mpeg;base64,${audioBase64}`);
    audio.play();
  };
  
  return (
    <div className="chat-interface">
      <div className="messages">
        {messages.map((message, index) => (
          <div key={index} className={`message ${message.role}`}>
            <div className="content">{message.content}</div>
            <div className="timestamp">{message.timestamp}</div>
          </div>
        ))}
      </div>
      
      <div className="input-area">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder={`Ask ${selectedPersona}...`}
          disabled={isLoading}
        />
        <button onClick={sendMessage} disabled={isLoading || !input.trim()}>
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
```

## 📊 Sports Data Integration

### 1. Data Service

```typescript
// lib/data.ts
export interface PlayerData {
  playerId: string;
  name: string;
  team: string;
  position: string;
  stats: any;
  projections: any;
}

export class DataService {
  static async getPlayers(): Promise<PlayerData[]> {
    const response = await fetch(`${API_BASE_URL}/data/players`, {
      headers: AuthService.getAuthHeaders()
    });
    
    const data = await response.json();
    return data.data;
  }
  
  static async getPlayerData(playerId: string): Promise<PlayerData> {
    const response = await fetch(`${API_BASE_URL}/data/player/${playerId}`, {
      headers: AuthService.getAuthHeaders()
    });
    
    const data = await response.json();
    return data.data;
  }
  
  static async getTrendingPlayers(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/data/trending`, {
      headers: AuthService.getAuthHeaders()
    });
    
    const data = await response.json();
    return data.data;
  }
  
  static async getTeamStandings(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/data/standings`, {
      headers: AuthService.getAuthHeaders()
    });
    
    const data = await response.json();
    return data.data;
  }
}
```

### 2. Player Rankings Component

```typescript
// components/PlayerRankings.tsx
import { useState, useEffect } from 'react';
import { DataService } from '../lib/data';

export function PlayerRankings() {
  const [players, setPlayers] = useState<PlayerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [position, setPosition] = useState('ALL');
  
  useEffect(() => {
    loadPlayers();
  }, [position]);
  
  const loadPlayers = async () => {
    try {
      setLoading(true);
      const data = await DataService.getPlayers();
      
      // Filter by position if selected
      const filtered = position === 'ALL' 
        ? data 
        : data.filter(p => p.position === position);
      
      setPlayers(filtered);
    } catch (error) {
      console.error('Failed to load players:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="player-rankings">
      <div className="filters">
        <select value={position} onChange={(e) => setPosition(e.target.value)}>
          <option value="ALL">All Positions</option>
          <option value="QB">Quarterback</option>
          <option value="RB">Running Back</option>
          <option value="WR">Wide Receiver</option>
          <option value="TE">Tight End</option>
        </select>
      </div>
      
      {loading ? (
        <div>Loading players...</div>
      ) : (
        <div className="rankings-list">
          {players.map((player, index) => (
            <div key={player.playerId} className="player-card">
              <div className="rank">#{index + 1}</div>
              <div className="info">
                <div className="name">{player.name}</div>
                <div className="team-pos">{player.team} - {player.position}</div>
              </div>
              <div className="stats">
                {/* Display relevant stats */}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## 📰 Zane AI Reporter Integration

### 1. Zane Service

```typescript
// lib/zane.ts
export interface NewsItem {
  id: string;
  headline: string;
  content: string;
  category: string;
  fantasyImpact: number;
  urgency: string;
  timestamp: string;
  zaneAnalysis: string;
  voiceReport?: string;
}

export interface DailyBriefing {
  id: string;
  date: string;
  topStories: NewsItem[];
  startEmSitEm: any;
  sleeperAlerts: any[];
  zaneCommentary: string;
  voiceBriefing?: string;
}

export class ZaneService {
  static async getDailyBriefing(date?: string): Promise<DailyBriefing> {
    const url = date 
      ? `${API_BASE_URL}/zane/briefing?date=${date}`
      : `${API_BASE_URL}/zane/briefing`;
      
    const response = await fetch(url, {
      headers: AuthService.getAuthHeaders()
    });
    
    const data = await response.json();
    return data.briefing;
  }
  
  static async getBreakingNews(): Promise<NewsItem[]> {
    const response = await fetch(`${API_BASE_URL}/zane/breaking-news`, {
      headers: AuthService.getAuthHeaders()
    });
    
    const data = await response.json();
    return data.news;
  }
  
  static async getHighImpactNews(): Promise<NewsItem[]> {
    const response = await fetch(`${API_BASE_URL}/zane/high-impact`, {
      headers: AuthService.getAuthHeaders()
    });
    
    const data = await response.json();
    return data.news;
  }
  
  static async getVoiceBriefing(date?: string): Promise<string> {
    const url = date 
      ? `${API_BASE_URL}/zane/voice-briefing?date=${date}`
      : `${API_BASE_URL}/zane/voice-briefing`;
      
    const response = await fetch(url, {
      headers: AuthService.getAuthHeaders()
    });
    
    const data = await response.json();
    return data.voiceBriefing;
  }
}
```

### 2. Zane Reporter Component

```typescript
// components/ZaneReporter.tsx
import { useState, useEffect } from 'react';
import { ZaneService, DailyBriefing, NewsItem } from '../lib/zane';

export function ZaneReporter() {
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [breakingNews, setBreakingNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadZaneContent();
  }, []);
  
  const loadZaneContent = async () => {
    try {
      setLoading(true);
      const [briefingData, newsData] = await Promise.all([
        ZaneService.getDailyBriefing(),
        ZaneService.getBreakingNews()
      ]);
      
      setBriefing(briefingData);
      setBreakingNews(newsData);
    } catch (error) {
      console.error('Failed to load Zane content:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const playVoiceBriefing = async () => {
    try {
      const audioBase64 = await ZaneService.getVoiceBriefing();
      const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
      audio.play();
    } catch (error) {
      console.error('Failed to play voice briefing:', error);
    }
  };
  
  if (loading) return <div>Loading Zane's reports...</div>;
  
  return (
    <div className="zane-reporter">
      {briefing && (
        <div className="daily-briefing">
          <h2>Daily Fantasy Briefing - {briefing.date}</h2>
          
          <button onClick={playVoiceBriefing} className="voice-button">
            🎤 Play Voice Briefing
          </button>
          
          <div className="commentary">
            <h3>Zane's Commentary</h3>
            <p>{briefing.zaneCommentary}</p>
          </div>
          
          <div className="start-sit">
            <h3>Start 'Em / Sit 'Em</h3>
            <div className="starts">
              <h4>Starts</h4>
              {briefing.startEmSitEm.starts.map((start, index) => (
                <div key={index} className="recommendation">
                  <strong>{start.player}</strong> - {start.reason}
                  <span className="confidence">Confidence: {start.confidence}/10</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      <div className="breaking-news">
        <h3>Breaking News</h3>
        {breakingNews.map(news => (
          <div key={news.id} className={`news-item impact-${news.fantasyImpact}`}>
            <div className="headline">{news.headline}</div>
            <div className="impact">Fantasy Impact: {news.fantasyImpact}/10</div>
            <div className="analysis">{news.zaneAnalysis}</div>
            {news.voiceReport && (
              <button onClick={() => playNewsAudio(news.voiceReport!)}>
                🔊 Play Report
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
  
  function playNewsAudio(audioBase64: string) {
    const audio = new Audio(`data:audio/mpeg;base64,${audioBase64}`);
    audio.play();
  }
}
```

## ⚡ Real-Time Features Integration

### 1. Pusher Setup

```typescript
// lib/pusher.ts
import Pusher from 'pusher-js';

const pusher = new Pusher('your_pusher_key', {
  cluster: 'us2',
  authEndpoint: `${API_BASE_URL}/realtime/pusher/auth`,
  auth: {
    headers: AuthService.getAuthHeaders()
  }
});

export { pusher };
```

### 2. Draft Room Integration

```typescript
// lib/draft.ts
export class DraftService {
  static async createDraftRoom(roomId: string, settings: any) {
    const response = await fetch(`${API_BASE_URL}/realtime/draft-room`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AuthService.getAuthHeaders()
      },
      body: JSON.stringify({ roomId, settings })
    });
    
    return response.json();
  }
  
  static async joinDraftRoom(roomId: string) {
    const response = await fetch(`${API_BASE_URL}/realtime/draft-room/${roomId}/join`, {
      method: 'POST',
      headers: AuthService.getAuthHeaders()
    });
    
    return response.json();
  }
  
  static async makeDraftPick(roomId: string, playerId: string, playerName: string) {
    const response = await fetch(`${API_BASE_URL}/realtime/draft-room/${roomId}/pick`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AuthService.getAuthHeaders()
      },
      body: JSON.stringify({ playerId, playerName })
    });
    
    return response.json();
  }
}
```

## 💳 Subscription Integration

### 1. Subscription Service

```typescript
// lib/subscription.ts
export class SubscriptionService {
  static async createCheckoutSession(tier: string, interval: string = 'monthly') {
    const response = await fetch(`${API_BASE_URL}/auth/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AuthService.getAuthHeaders()
      },
      body: JSON.stringify({ tier, interval })
    });
    
    const data = await response.json();
    
    // Redirect to Stripe checkout
    window.location.href = data.checkoutUrl;
  }
  
  static async getSubscriptionStatus() {
    const response = await fetch(`${API_BASE_URL}/auth/subscription`, {
      headers: AuthService.getAuthHeaders()
    });
    
    return response.json();
  }
}
```

## 🔧 Error Handling

### 1. API Error Handler

```typescript
// lib/api.ts
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function apiRequest(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...AuthService.getAuthHeaders(),
      ...options.headers
    }
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new ApiError(response.status, error.error || 'API request failed');
  }
  
  return response.json();
}
```

### 2. Error Boundary Component

```typescript
// components/ErrorBoundary.tsx
import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false })}>
            Try Again
          </button>
        </div>
      );
    }
    
    return this.props.children;
  }
}
```

## 📱 Mobile Responsiveness

### 1. Responsive Chat Interface

```css
/* styles/chat.css */
.chat-interface {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-height: 600px;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.message {
  margin-bottom: 1rem;
  padding: 0.5rem;
  border-radius: 8px;
}

.message.user {
  background: #007bff;
  color: white;
  margin-left: 20%;
}

.message.assistant {
  background: #f8f9fa;
  margin-right: 20%;
}

.input-area {
  display: flex;
  padding: 1rem;
  border-top: 1px solid #dee2e6;
}

.input-area input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
  margin-right: 0.5rem;
}

.input-area button {
  padding: 0.5rem 1rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

@media (max-width: 768px) {
  .message.user {
    margin-left: 10%;
  }
  
  .message.assistant {
    margin-right: 10%;
  }
  
  .input-area {
    flex-direction: column;
  }
  
  .input-area input {
    margin-right: 0;
    margin-bottom: 0.5rem;
  }
}
```

## 🚀 Performance Optimization

### 1. API Response Caching

```typescript
// lib/cache.ts
class ApiCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private ttl = 5 * 60 * 1000; // 5 minutes
  
  get(key: string) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }
  
  set(key: string, data: any) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }
}

export const apiCache = new ApiCache();
```

### 2. Lazy Loading Components

```typescript
// components/LazyComponents.ts
import { lazy } from 'react';

export const ChatInterface = lazy(() => import('./ChatInterface'));
export const PlayerRankings = lazy(() => import('./PlayerRankings'));
export const ZaneReporter = lazy(() => import('./ZaneReporter'));
```

## ✅ Integration Checklist

- [ ] Firebase authentication configured
- [ ] API base URL set correctly
- [ ] Authentication service implemented
- [ ] Persona chat interface working
- [ ] Voice playback functional
- [ ] Sports data displaying
- [ ] Zane reporter integrated
- [ ] Real-time features connected
- [ ] Subscription flow working
- [ ] Error handling implemented
- [ ] Mobile responsiveness tested
- [ ] Performance optimized

**🎉 Your frontend is now fully integrated with the SideKick Fantasy Sports backend!**

