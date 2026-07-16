# Reddit Sentiment Analysis Tool

A powerful tool that analyzes Reddit posts for sentiment and emotional content using Google's Gemini 2.0 Flash model. This project helps users discover and analyze discussions across different subreddits based on sentiment patterns.

## Features

- **Sentiment-Based Search**: Search Reddit posts with emotional context
- **Real-Time Analysis**: Analyzes posts using Google's Gemini 2.0 Flash model
- **Subreddit Filtering**: Focus on specific community discussions
- **Visual Feedback**: Color-coded sentiment badges and intuitive UI
- **Time-Based Cleanup**: Automatic database maintenance with MongoDB TTL indexes

## Tech Stack

- **Backend**:

  - Node.js with TypeScript
  - Express.js
  - MongoDB for caching
  - Google Gemini 2.0 Flash API
  - Reddit API

- **Frontend**:
  - React with TypeScript
  - Chakra UI components
  - React Query for data fetching
  - Framer Motion for animations

## Prerequisites

1. **Node.js and npm**

   ```bash
   # Check if Node.js is installed
   node --version  # Should be v16 or higher
   npm --version

   # If not installed, use brew to install
   brew install node
   ```

2. **MongoDB Installation**

   ```bash
   # Install MongoDB using Homebrew
   brew tap mongodb/brew
   brew install mongodb-community

   # Start MongoDB service
   brew services start mongodb/brew/mongodb-community

   # Verify MongoDB is running
   mongosh
   ```

3. **API Keys Setup**
   - Reddit API credentials (from https://www.reddit.com/prefs/apps)
   - Google Gemini API key (from https://makersuite.google.com/app/apikey)

## Installation

1. **Clone and Install Dependencies**

   ```bash
   # Clone repository
   git clone <repository-url>
   cd GummyRedditClone

   # Install backend dependencies
   npm install

   # Install frontend dependencies
   cd frontend
   npm install
   cd ..
   ```

2. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/gummy_reddit
   REDDIT_CLIENT_ID=your_client_id
   REDDIT_CLIENT_SECRET=your_client_secret
   REDDIT_USER_AGENT=GummyRedditClone/1.0.0
   LLM_PROVIDER=gemini # gemini | lmstudio | claude
   MODEL=gemini-2.0-flash
   GOOGLE_API_KEY=your_gemini_api_key
   ANTHROPIC_API_KEY=your_anthropic_api_key
   LM_STUDIO_URL=http://localhost:1234
   ```

## Running the Application

1. **Start MongoDB** (if not already running)

   ```bash
   brew services start mongodb/brew/mongodb-community
   ```

2. **Development Mode**

   ```bash
   # Start both frontend and backend in development mode
   npm run dev

   # The application will be available at:
   # Frontend: http://localhost:5173
   # Backend: http://localhost:3000
   ```

3. **Production Mode**

   ```bash
   # Build the application
   npm run build

   # Start the production server
   npm start
   ```

## Search Examples

The search format follows the pattern: `sentiment in r/subreddit`

Example queries:

```
Pain & Anger related post in r/NorthKorea
Positive experiences with meditation in r/Meditation
Frustration about career advice in r/careerguidance
Debates about personal finance habits in r/personalfinance
Happy moments in r/wholesome
```

Each result shows:

- Post title
- Author and subreddit
- Sentiment analysis with score
- Emotional analysis
- Link to original Reddit post

## Development Commands

```bash
# Running tests
npm test
npm run test:watch

# Linting
npm run lint

# Clean build
npm run clean
npm run build

# Running frontend only
cd frontend
npm run dev

# Running backend only
npm run dev:backend
```

## Project Structure

```
.
├── src/                  # Backend source code
│   ├── controllers/      # Request handlers
│   ├── middleware/       # Express middlewares
│   ├── models/          # MongoDB models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   └── utils/           # Helper functions
├── frontend/            # Frontend source code
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── services/    # API services
│   │   └── types/       # TypeScript types
│   └── public/          # Static files
└── tests/              # Test files
```

## Troubleshooting

1. **MongoDB Connection Issues**

   ```bash
   # Check if MongoDB is running
   brew services list

   # Restart MongoDB if needed
   brew services restart mongodb/brew/mongodb-community

   # Check MongoDB logs
   tail -f /usr/local/var/log/mongodb/mongo.log
   ```

2. **Frontend Not Loading**

   - Check if all dependencies are installed
   - Verify the development server is running
   - Check browser console for errors
   - Ensure proxy settings in vite.config.ts are correct

3. **Backend API Issues**
   - Verify environment variables are set correctly
   - Check MongoDB connection
   - Ensure Reddit API credentials are valid
   - Verify Google Gemini API key is active

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License - see the LICENSE file for details.

## Acknowledgments

- Google Gemini API for sentiment analysis
- Reddit API for data access
- Chakra UI for the component library
- MongoDB for efficient data caching

## API Documentation

The API documentation is available through Swagger UI when the server is running:

```bash
# Start the development server
npm run dev

# Access Swagger UI at:
http://localhost:3000/api-docs
```

### Available Endpoints

#### GET /api/search

Search Reddit posts with sentiment analysis.

**Query Parameters:**

- `q` (required): Search query in the format "sentiment in r/subreddit"

**Example Requests:**

```bash
# Using curl
curl "http://localhost:3000/api/search?q=positive%20reviews%20about%20Tesla%20in%20r/cars"

# Using httpie
http GET "http://localhost:3000/api/search?q=positive reviews about Tesla in r/cars"
```

**Success Response (200):**

```json
[
  {
    "id": "abc123",
    "title": "Tesla Model 3 is amazing!",
    "author": "user123",
    "subreddit": "cars",
    "permalink": "/r/cars/comments/abc123",
    "sentiment": {
      "label": "positive",
      "score": 0.92,
      "analysis": "Strong positive sentiment about the car's performance and features",
      "emotions": ["excitement", "satisfaction", "happiness"]
    }
  }
]
```

**Error Responses:**

- `400`: Invalid request format
- `500`: Server error

### Logging Configuration

The application uses Winston for logging with the following features:

- **Log Levels**: error, warn, info, debug
- **Output Formats**:
  - Console (colorized, with timestamps)
  - File (JSON format with timestamps)
- **Log Files**:
  - `logs/error.log`: Error messages only
  - `logs/combined.log`: All log messages

### Environment Variables for Logging

```env
# Logging Configuration
LOG_LEVEL=info        # error | warn | info | debug
LOG_TO_CONSOLE=false  # true | false
LOG_DIR=logs         # Directory for log files
```

### Usage Examples

```typescript
import { Logger } from "./utils/logger";

// Configure logging
Logger.configure({
  logToConsole: true, // Enable console output
  logLevel: "debug", // Set log level
});

// Log messages
Logger.info("Application started");
Logger.debug("Processing request", { requestId: "123" });
Logger.error("Failed to connect", new Error("Connection timeout"));
Logger.warn("Rate limit approaching");
```

### Log File Structure

Each log entry includes:

- Timestamp (YYYY-MM-DD HH:mm:ss)
- Log Level
- Message
- Additional metadata (if provided)

Example log entry:

```
2025-05-25 10:30:45 [INFO] Processing batch of 10 posts {"batchId": "123", "processingTime": "2.5s"}
```
