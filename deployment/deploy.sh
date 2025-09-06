#!/bin/bash

# Deployment script for Sidekick Fantasy Sports Backend
# Usage: ./deployment/deploy.sh [environment]

set -e

# Configuration
ENVIRONMENT=${1:-production}
PROJECT_ID="sidekick-fantasy-sports"

echo "🚀 Deploying Sidekick Fantasy Sports Backend to $ENVIRONMENT"

# Validate Firebase CLI
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Please install it first:"
    echo "npm install -g firebase-tools"
    exit 1
fi

# Authenticate Firebase (if not already logged in)
echo "🔐 Checking Firebase authentication..."
if ! firebase projects:list &> /dev/null; then
    echo "Please login to Firebase:"
    firebase login
fi

# Set Firebase project
echo "📋 Setting Firebase project to $PROJECT_ID"
firebase use $PROJECT_ID

# Install dependencies
echo "📦 Installing dependencies..."
cd functions
npm install
cd ..

# Build TypeScript
echo "🔨 Building TypeScript..."
cd functions
npm run build
cd ..

# Deploy Firestore rules and indexes
echo "📁 Deploying Firestore rules and indexes..."
firebase deploy --only firestore:rules,firestore:indexes

# Deploy Functions
echo "☁️  Deploying Cloud Functions..."
firebase deploy --only functions

echo "✅ Deployment completed successfully!"
echo ""
echo "🔗 Available endpoints:"
echo "• API Base: https://us-central1-$PROJECT_ID.cloudfunctions.net/api"
echo "• Sidekicks: https://us-central1-$PROJECT_ID.cloudfunctions.net/api/sidekicks"
echo ""
echo "📚 Next steps:"
echo "1. Initialize default sidekicks (admin only):"
echo "   POST /api/sidekicks/initialize"
echo ""
echo "2. Test the API:"
echo "   GET /api/sidekicks/available"
echo ""
echo "3. Update your frontend configuration with the new endpoints"
