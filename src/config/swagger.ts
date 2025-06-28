import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Reddit Sentiment Analysis API',
            version: '1.0.0',
            description: 'API for analyzing Reddit posts with sentiment analysis using Google Gemini',
            license: {
                name: 'ISC',
                url: 'https://opensource.org/licenses/ISC',
            },
            contact: {
                name: 'API Support',
                url: 'https://github.com/yourusername/GummyRedditClone',
            },
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Development server',
            },
        ],
    },
    apis: ['./src/routes/*.ts', './src/models/*.ts'], // Path to the API routes and models
};

export const specs = swaggerJsdoc(options);
