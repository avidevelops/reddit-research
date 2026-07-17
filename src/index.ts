import cors from 'cors';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { config } from './config/config';
import { specs } from './config/swagger';
import { apiErrorHandler } from './middleware/errorMiddleware';
import pipelineRoutes from './routes/pipeline';
import scrapingRoutes from './routes/scraping';
import searchRoutes from './routes/search';
import trendingRoutes from './routes/trending';
import { Logger } from './utils/logger';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Routes
app.use('/api', searchRoutes);
app.use('/api/scrape', scrapingRoutes);
app.use('/api/trending', trendingRoutes);
app.use('/api/pipeline', pipelineRoutes);

// Error handling
app.use((req, res, next) => {
    next(new Error('Not Found'));
});
app.use(apiErrorHandler);

app.listen(config.port, (error?: Error) => {
    if (error) {
        Logger.error(`Failed to start server on port ${config.port}`, error);
        process.exitCode = 1;
        return;
    }
    Logger.info(`Server is running on port ${config.port}`);
    Logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    Logger.info(`API Documentation available at http://localhost:${config.port}/api-docs`);
});
