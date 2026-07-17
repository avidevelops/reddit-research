declare global {
    namespace NodeJS {
        interface ProcessEnv {
            PORT?: string;
            NODE_ENV: 'development' | 'production';
            REDDIT_CLIENT_ID: string;
            REDDIT_CLIENT_SECRET: string;
            REDDIT_USER_AGENT: string;
            GOOGLE_API_KEY: string;
        }
    }
}
