#!/bin/bash

# Initialize default sidekicks in the database
# Usage: ./deployment/scripts/init-sidekicks.sh [project-id]

set -e

PROJECT_ID=${1:-sidekick-fantasy-sports}
FUNCTION_URL="https://us-central1-${PROJECT_ID}.cloudfunctions.net/initializeDefaultSidekicks"

echo "🎯 Initializing default sidekicks..."

# Get auth token
TOKEN=$(firebase auth:print-access-token 2>/dev/null || echo "")

if [ -z "$TOKEN" ]; then
    echo "❌ Not authenticated. Please run 'firebase login' first."
    exit 1
fi

# Call the initialization function
echo "📞 Calling initialization function..."
response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    "$FUNCTION_URL")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n -1)

if [ "$http_code" -eq 200 ]; then
    echo "✅ Default sidekicks initialized successfully!"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
else
    echo "❌ Failed to initialize sidekicks (HTTP $http_code):"
    echo "$body"
    exit 1
fi
