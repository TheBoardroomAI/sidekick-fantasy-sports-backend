#!/bin/bash

# Test the Sidekick API endpoints
# Usage: ./deployment/scripts/test-api.sh [project-id]

set -e

PROJECT_ID=${1:-sidekick-fantasy-sports}
API_BASE="https://us-central1-${PROJECT_ID}.cloudfunctions.net/api"

echo "🧪 Testing Sidekick API endpoints..."

# Test available sidekicks endpoint
echo ""
echo "📋 Testing GET /sidekicks/available..."
response=$(curl -s -w "\n%{http_code}" "$API_BASE/sidekicks/available")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n -1)

if [ "$http_code" -eq 200 ]; then
    echo "✅ Available sidekicks endpoint working"
    echo "$body" | jq '.data.count' 2>/dev/null | sed 's/^/   Sidekicks available: /'
else
    echo "❌ Available sidekicks endpoint failed (HTTP $http_code)"
    echo "   Response: $body"
fi

# Test recommendations endpoint (will fail without auth, but should return proper error)
echo ""
echo "🎯 Testing GET /sidekicks/recommended (expect auth error)..."
response=$(curl -s -w "\n%{http_code}" "$API_BASE/sidekicks/recommended")
http_code=$(echo "$response" | tail -n1)

if [ "$http_code" -eq 401 ] || [ "$http_code" -eq 403 ]; then
    echo "✅ Recommendations endpoint properly protected"
else
    echo "⚠️  Unexpected response from recommendations endpoint (HTTP $http_code)"
fi

echo ""
echo "🔗 API Base URL: $API_BASE"
echo "📚 Documentation: Check the docs/ folder for complete API reference"
