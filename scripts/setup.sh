#!/bin/bash

set -e

echo "🚀 Starting MANGU Platform Setup..."
echo "================================="

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check for npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    exit 1
fi

echo "✅ npm $(npm -v) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create environment file
echo "🔐 Creating environment file..."
if [ ! -f ".env.local" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env.local
        echo "⚠️  Please update .env.local with your credentials"
    else
        echo "⚠️  .env.example not found. Please create .env.local manually"
    fi
fi

# Build the project
echo "🏗️ Building project..."
npm run build

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 Next steps:"
echo "1. Update .env.local with your Supabase credentials"
echo "2. Run database migrations in Supabase SQL Editor"
echo "3. Run: npm run dev"
echo "4. Visit: http://localhost:3000"
echo ""
echo "📚 Useful commands:"
echo "   npm run dev          # Start development server"
echo "   npm run build        # Build for production"
echo "   npm run start        # Start production server"
echo "   npm run lint         # Run ESLint"
echo "   npm run type-check   # Type check"
echo "   npm run db:seed      # Seed database"
echo ""
