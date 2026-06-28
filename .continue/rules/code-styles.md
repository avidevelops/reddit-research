# Code Style Guidelines

## TypeScript Standards
- Use strict TypeScript mode (enabled in tsconfig.json)
- Explicit return types on all functions
- Interface-first approach for data structures
- Avoid `any` types

## Naming Conventions
- **Files**: PascalCase for classes, camelCase for utils (e.g., `RedditService.ts`, `logger.ts`)
- **Classes**: PascalCase (e.g., `SentimentAnalysisService`)
- **Methods/Functions**: camelCase
- **Constants**: UPPER_SNAKE_CASE for true constants
- **Environment Variables**: SCREAMING_SNAKE_CASE in `.env`

## Async Patterns
- Always use `async/await` over callbacks
- Handle errors with try/catch blocks
- Use proper error classes from `utils/errors.ts`

## Import Order
1. External dependencies
2. Internal types/interfaces
3. Internal services/utils
4. Relative imports (./, ../)

## Error Handling
- Use Winston logger for all logging
- Log levels: error, warn, info, debug
- Always include context in error logs
- Custom error classes for domain-specific errors

## MongoDB Patterns
- Use Mongoose models in `src/models/`
- Implement TTL indexes for cache cleanup
- Always handle connection errors gracefully
