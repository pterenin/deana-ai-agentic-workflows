#!/bin/bash

echo "🚀 Deana AI Consumer App - Quick Start"
echo "======================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16 or higher."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if agent server is running
echo "🔍 Checking if agent server is running..."
if curl -s http://localhost:3060/health > /dev/null; then
    echo "✅ Agent server is running on port 3060"
else
    echo "⚠️  Agent server is not running on port 3060"
    echo "   Please start the agent server first:"
    echo "   cd .. && npx ts-node src/streaming-agents-server.ts"
    echo ""
    echo "   Or run this in a separate terminal:"
    echo "   cd .. && npm run dev"
    echo ""
    read -p "Press Enter to continue anyway..."
fi

# Start the Express app
echo "🚀 Starting Express consumer app..."
echo "📡 Web interface: http://localhost:3000"
echo "📡 API endpoints:"
echo "   - POST http://localhost:3000/api/chat/stream (streaming)"
echo "   - POST http://localhost:3000/api/chat (regular)"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm start
