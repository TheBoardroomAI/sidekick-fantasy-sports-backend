# Authentication Flow - Sidekick Selection System

## Overview

The Sidekick Selection System uses Firebase Authentication for user management and API security. This document outlines the complete authentication flow for frontend integration.

## Authentication Architecture

```
Frontend App → Firebase Auth → Sidekick API → Firestore
     ↓              ↓              ↓           ↓
   User Login → ID Token → Verify Token → Access Data
```

## Setup Requirements

### 1. Firebase Project Configuration

```typescript
// firebase-config.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
```

### 2. SDK Integration

```typescript
// auth-context.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut 
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { getDefaultSidekickClient } from '../sdk/sidekick-client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setLoading(false);

      // Update sidekick client with auth token
      const sidekickClient = getDefaultSidekickClient();

      if (user) {
        try {
          const token = await user.getIdToken();
          sidekickClient.setAuthToken(token);

          // Refresh token periodically
          const refreshToken = setInterval(async () => {
            try {
              const freshToken = await user.getIdToken(true);
              sidekickClient.setAuthToken(freshToken);
            } catch (error) {
              console.error('Token refresh failed:', error);
            }
          }, 55 * 60 * 1000); // Refresh every 55 minutes

          // Store interval ID for cleanup
          (user as any)._tokenRefreshInterval = refreshToken;
        } catch (error) {
          console.error('Failed to get ID token:', error);
        }
      } else {
        sidekickClient.clearAuthToken();

        // Clear any existing refresh interval
        if ((user as any)?._tokenRefreshInterval) {
          clearInterval((user as any)._tokenRefreshInterval);
        }
      }
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signIn,
      signUp,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

## Authentication States

### 1. Initial Loading State

```typescript
function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return user ? <AuthenticatedApp /> : <LoginScreen />;
}
```

### 2. Login Component

```typescript
// components/LoginForm.tsx
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setError('');
      setLoading(true);
      await signIn(email, password);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Signing In...' : 'Sign In'}
      </button>
      {error && <div className="error">{error}</div>}
    </form>
  );
}
```

### 3. Protected Routes

```typescript
// components/ProtectedRoute.tsx
import React from 'react';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ProtectedRoute({ children, fallback }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return fallback || <div>Please log in to access this page.</div>;
  }

  return <>{children}</>;
}

// Usage
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginForm />} />
        <Route 
          path="/sidekicks" 
          element={
            <ProtectedRoute>
              <SidekickSelector />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
}
```

## Token Management

### 1. Automatic Token Refresh

```typescript
// utils/tokenManager.ts
import { User } from 'firebase/auth';
import { getDefaultSidekickClient } from '../sdk/sidekick-client';

export class TokenManager {
  private refreshInterval?: NodeJS.Timeout;

  startTokenRefresh(user: User) {
    // Initial token set
    this.updateToken(user);

    // Refresh every 55 minutes (tokens expire in 1 hour)
    this.refreshInterval = setInterval(() => {
      this.updateToken(user, true);
    }, 55 * 60 * 1000);
  }

  stopTokenRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = undefined;
    }
  }

  private async updateToken(user: User, forceRefresh = false) {
    try {
      const token = await user.getIdToken(forceRefresh);
      const client = getDefaultSidekickClient();
      client.setAuthToken(token);
    } catch (error) {
      console.error('Token update failed:', error);
      // Handle token refresh failure
      this.handleTokenError(error);
    }
  }

  private handleTokenError(error: any) {
    // Log out user if token refresh fails
    if (error.code === 'auth/user-token-expired') {
      // Redirect to login
      window.location.href = '/login';
    }
  }
}
```

### 2. Manual Token Refresh

```typescript
// hooks/useTokenRefresh.ts
import { useAuth } from '../contexts/AuthContext';
import { useCallback } from 'react';
import { getDefaultSidekickClient } from '../sdk/sidekick-client';

export function useTokenRefresh() {
  const { user } = useAuth();

  const refreshToken = useCallback(async () => {
    if (!user) return null;

    try {
      const token = await user.getIdToken(true);
      const client = getDefaultSidekickClient();
      client.setAuthToken(token);
      return token;
    } catch (error) {
      console.error('Manual token refresh failed:', error);
      throw error;
    }
  }, [user]);

  return refreshToken;
}
```

## Error Handling

### 1. Authentication Errors

```typescript
// utils/authErrors.ts
export function getAuthErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case 'auth/user-not-found':
      return 'No account found with this email address.';
    case 'auth/wrong-password':
      return 'Incorrect password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Invalid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please try again later.';
    default:
      return 'An authentication error occurred. Please try again.';
  }
}
```

### 2. API Authentication Errors

```typescript
// Handle 401 responses from Sidekick API
import { getDefaultSidekickClient } from '../sdk/sidekick-client';

export function setupAuthErrorHandling() {
  const client = getDefaultSidekickClient();

  client.addEventListener('auth_error', async (error) => {
    console.error('Sidekick API auth error:', error);

    // Try to refresh token
    const { user } = useAuth();
    if (user) {
      try {
        const newToken = await user.getIdToken(true);
        client.setAuthToken(newToken);

        // Optionally retry the failed request
        // This depends on your SDK implementation
      } catch (refreshError) {
        // Token refresh failed, redirect to login
        window.location.href = '/login';
      }
    } else {
      // No user, redirect to login
      window.location.href = '/login';
    }
  });
}
```

## Custom Claims (Admin Users)

### 1. Setting Admin Claims (Server-side)

```typescript
// Cloud Function to set admin claims
import * as admin from 'firebase-admin';

export const setAdminClaim = functions.https.onCall(async (data, context) => {
  // Verify caller is already an admin
  if (!context.auth?.token?.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Admin required');
  }

  const { uid } = data;

  try {
    await admin.auth().setCustomUserClaims(uid, { admin: true });
    return { success: true };
  } catch (error) {
    throw new functions.https.HttpsError('internal', 'Failed to set admin claim');
  }
});
```

### 2. Checking Admin Status

```typescript
// hooks/useAdminStatus.ts
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';

export function useAdminStatus() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAdminStatus() {
      if (user) {
        try {
          const idTokenResult = await user.getIdTokenResult();
          setIsAdmin(!!idTokenResult.claims.admin);
        } catch (error) {
          console.error('Failed to check admin status:', error);
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    }

    checkAdminStatus();
  }, [user]);

  return { isAdmin, loading };
}
```

## Social Authentication (Optional)

### 1. Google Sign-In

```typescript
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../config/firebase';

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error('Google sign-in error:', error);
    throw error;
  }
}
```

### 2. Social Login Component

```typescript
// components/SocialLogin.tsx
import React from 'react';
import { signInWithGoogle } from '../utils/socialAuth';

export function SocialLogin() {
  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Social login failed:', error);
    }
  };

  return (
    <div className="social-login">
      <button onClick={handleGoogleSignIn} className="google-button">
        Sign in with Google
      </button>
    </div>
  );
}
```

## Security Best Practices

1. **Always validate tokens server-side**
2. **Use HTTPS for all API calls**
3. **Implement proper CORS policies**
4. **Set appropriate token expiration times**
5. **Monitor for suspicious authentication patterns**
6. **Use Firebase Security Rules for data access**
7. **Implement rate limiting on authentication endpoints**

## Testing Authentication

### 1. Unit Tests

```typescript
// __tests__/auth.test.ts
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginForm } from '../components/LoginForm';

// Mock Firebase Auth
jest.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: jest.fn(),
}));

test('login form submits with correct credentials', async () => {
  render(<LoginForm />);

  fireEvent.change(screen.getByPlaceholderText('Email'), {
    target: { value: 'test@example.com' }
  });

  fireEvent.change(screen.getByPlaceholderText('Password'), {
    target: { value: 'password123' }
  });

  fireEvent.click(screen.getByText('Sign In'));

  await waitFor(() => {
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      'test@example.com',
      'password123'
    );
  });
});
```

### 2. Integration Tests

```typescript
// __tests__/sidekick-auth-integration.test.ts
import { useSidekickSelection } from '../hooks/useSidekickSelection';
import { getDefaultSidekickClient } from '../sdk/sidekick-client';

test('sidekick API uses auth token', async () => {
  // Mock authenticated user
  const mockUser = {
    getIdToken: jest.fn().mockResolvedValue('mock-token')
  };

  // Test that SDK receives the token
  const client = getDefaultSidekickClient();
  client.setAuthToken('mock-token');

  // Test API call with authentication
  const { result } = renderHook(() => useSidekickSelection());

  await waitFor(() => {
    expect(result.current.availableSidekicks).toBeDefined();
  });
});
```

---

*This authentication flow integrates with the Sidekick Selection System. For complete API documentation, see [API Reference](../api/API_REFERENCE.md).*
