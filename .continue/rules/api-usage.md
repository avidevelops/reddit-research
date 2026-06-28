# API Integration Patterns

## Reddit API
- OAuth2 client credentials flow
- Rate limiting: Monitor 60 requests/minute for OAuth
- User-Agent required: `GummyRedditClone/1.0.0`
- Credentials stored in env: `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`

## Google Gemini API
- Model: `gemini-2.0-flash` (primary)
- API key from: https://makersuite.google.com/app/apikey
- Environment: `GOOGLE_API_KEY`
- Sentiment analysis prompt engineering in `SentimentAnalysisService.ts`

## Search Query Format
Users search with pattern: `{sentiment} in r/{subreddit}`
Examples:
- `Pain & Anger related post in r/NorthKorea`
- `Positive reviews about Tesla in r/cars`
- `Frustration about iPhone battery in r/Apple`

## Response Structure
```typescript
interface SentimentResult {
  id: string;
  title: string;
  author: string;
  subreddit: string;
  permalink: string;
  sentiment: {
    label: 'positive' | 'negative' | 'neutral';
    score: number; // 0.0 to 1.0
    analysis: string;
    emotions: string[]; // e.g., ['excitement', 'satisfaction']
  };
}
