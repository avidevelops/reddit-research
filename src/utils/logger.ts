import path from 'path';
import winston from 'winston';

// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};

// Define log colors
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue',
};

// Utility function to parse file size strings (e.g., "10M", "1G") to bytes
function parseFileSize(size: string): number {
    const units = {
        'K': 1024,
        'M': 1024 * 1024,
        'G': 1024 * 1024 * 1024
    };
    const match = size.match(/^(\d+)([KMG])$/i);
    if (!match) return 10 * 1024 * 1024; // Default to 10MB
    const [, num, unit] = match;
    return parseInt(num) * (units[unit.toUpperCase() as keyof typeof units] || 1);
}

// Add colors to winston
winston.addColors(colors);

import { config } from '../config/config';

// Create log directory if it doesn't exist
const LOG_DIR = path.join(process.cwd(), config.logging.directory);
if (!require('fs').existsSync(LOG_DIR)) {
    require('fs').mkdirSync(LOG_DIR, { recursive: true });
}

// Define the format for logs
const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
        return `${timestamp} [${level.toUpperCase()}] ${message} ${metaStr}`;
    })
);

// Create console transport
const consoleTransport = new winston.transports.Console({
    format: winston.format.combine(
        winston.format.colorize(),
        format
    ),
});

// Create file transports with rotation and compression
const fileTransports = {
    error: new winston.transports.File({
        filename: path.join(LOG_DIR, 'error.log'),
        level: 'error',
        maxsize: parseFileSize(config.logging.maxLogSize || '10M'),
        maxFiles: config.logging.maxLogAge,
        tailable: true,
        zippedArchive: config.logging.compress,
    }),
    combined: new winston.transports.File({
        filename: path.join(LOG_DIR, 'combined.log'),
        maxsize: parseFileSize(config.logging.maxLogSize || '10M'),
        maxFiles: config.logging.maxLogAge,
        tailable: true,
        zippedArchive: config.logging.compress,
    }),
};

// Create the logger instance
const logger = winston.createLogger({
    level: config.logging.level,
    levels,
    format,
    transports: [fileTransports.error, fileTransports.combined],
});

// Add console transport in development
if (process.env.NODE_ENV === 'development') {
    logger.add(consoleTransport);
}

export class Logger {
    private static instance = logger;
    private static logToConsole = config.logging.toConsole;

    static configure(options: {
        logToConsole?: boolean;
        logLevel?: string;
        maxLogSize?: string;
        maxLogAge?: number;
        compress?: boolean;
    }) {
        // Update console transport
        if (options.logToConsole !== undefined) {
            this.logToConsole = options.logToConsole;
            if (options.logToConsole) {
                this.instance.add(consoleTransport);
            } else {
                this.instance.remove(consoleTransport);
            }
        }

        // Update log level
        if (options.logLevel) {
            this.instance.level = options.logLevel;
        }

        // Update file rotation settings
        if (options.maxLogSize || options.maxLogAge || options.compress !== undefined) {
            const maxsize = options.maxLogSize ? parseFileSize(options.maxLogSize) : undefined;
            const maxFiles = options.maxLogAge;
            const zippedArchive = options.compress;

            // Update both transports
            ['error', 'combined'].forEach(transportName => {
                const transport = this.instance.transports.find(
                    t => t instanceof winston.transports.File && 
                    t.filename?.includes(`${transportName}.log`)
                ) as winston.transports.FileTransportInstance;
                
                if (transport) {
                    if (maxsize) transport.maxsize = maxsize;
                    if (maxFiles) transport.maxFiles = maxFiles;
                    if (zippedArchive !== undefined) transport.zippedArchive = zippedArchive;
                }
            });
        }
    }

    static info(message: string, ...meta: any[]) {
        this.instance.info(message, ...meta);
    }

    static error(message: string, error?: any) {
        this.instance.error(message, { error: error || '' });
    }

    static warn(message: string, ...meta: any[]) {
        this.instance.warn(message, ...meta);
    }

    static debug(message: string, ...meta: any[]) {
        this.instance.debug(message, ...meta);
    }

    static getLogFilePath(type: 'error' | 'combined'): string {
        return path.join(LOG_DIR, `${type}.log`);
    }
}
