# Reddit Research Architecture

## Overview
A sentiment analysis tool that analyzes Reddit posts using Google's Gemini 2.0 Flash model with MongoDB caching.

## Tech Stack
- **Backend**: Node.js + TypeScript + Express.js
- **Frontend**: React + TypeScript + Chakra UI + Vite
- **Database**: MongoDB with TTL indexes for caching
- **AI**: Google Gemini 2.0 Flash API
- **External APIs**: Reddit API

## Directory Structure

src/
├── config/ # Environment and app configuration
├── controllers/ # Express route handlers
├── middleware/ # Express middleware (auth, validation, etc.)
├── models/ # MongoDB Mongoose models
├── routes/ # API route definitions
├── services/ # Business logic layer
│ ├── RedditService.ts # Reddit API integration
│ ├── SentimentAnalysisService.ts # Gemini AI analysis
│ ├── ReferenceMaterialService.ts # Caching and reference data
│ └── TrendingTopicsService.ts # Trending analysis
├── types/ # TypeScript type definitions
├── utils/ # Helper functions and logger
└── tests/ # Jest test files

frontend/
├── src/
│ ├── components/ # React UI components
│ ├── services/ # Frontend API clients
│ └── types/ # Frontend TypeScript types
└── public/ # Static assets


## Key Services
- **RedditService**: Handles Reddit API authentication and data fetching
- **SentimentAnalysisService**: Google Gemini integration for sentiment scoring
- **ReferenceMaterialService**: MongoDB caching layer with TTL cleanup
- **TrendingTopicsService**: Aggregates trending discussions by sentiment

## API Endpoints
- `GET /api/search?q={sentiment}+in+r/subreddit` - Main search endpoint
- Swagger docs at `/api-docs` when server is running
