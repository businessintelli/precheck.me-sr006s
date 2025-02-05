import express, { Express, Request, Response, NextFunction } from 'express'; // @version ^4.18.2
import cors from 'cors'; // @version ^2.8.5
import helmet from 'helmet'; // @version ^7.1.0
import compression from 'compression'; // @version ^1.7.4
import cookieParser from 'cookie-parser'; // @version ^1.4.6
import session from 'express-session'; // @version ^1.17.3
import promMiddleware from 'express-prometheus-middleware'; // @version ^1.2.0
import { errorHandler } from './middleware/error.middleware';
import { validateRequest } from './middleware/validation.middleware';
import { rateLimiter } from './middleware/rate-limit.middleware';
import { logger } from './utils/logger';

/**
 * Configure and create Express application with comprehensive security measures
 * and enterprise-grade middleware setup
 */
export const createApp = (): Express => {
  const app = express();

  // Trust proxy settings for secure header handling
  app.set('trust proxy', SECURITY_CONFIG.trustProxy);

  // Basic security headers with helmet
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", process.env.API_URL],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "same-site" },
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true
  }));

  // CORS configuration with environment-specific origins
  app.use(cors(CORS_OPTIONS));

  // Response compression
  app.use(compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
    threshold: 1024
  }));

  // Request body parsing with size limits
  app.use(express.json({
    limit: '10mb',
    verify: (req: Request, res: Response, buf: Buffer) => {
      req.rawBody = buf;
    }
  }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Secure cookie parsing
  app.use(cookieParser(SECURITY_CONFIG.cookieSecret));

  // Session configuration with Redis store
  const RedisStore = require('connect-redis').default;
  app.use(session({
    store: new RedisStore({
      client: require('./services/cache/redis.service').redisClient,
      prefix: 'session:',
      ttl: 86400 // 24 hours
    }),
    secret: SECURITY_CONFIG.sessionSecret,
    name: 'sessionId',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Global rate limiting
  app.use(rateLimiter(RATE_LIMIT_CONFIG));

  // Request monitoring and metrics
  app.use(promMiddleware({
    metricsPath: '/metrics',
    collectDefaultMetrics: true,
    requestDurationBuckets: [0.1, 0.5, 1, 1.5, 2, 3, 5, 10],
    requestLengthBuckets: [512, 1024, 5120, 10240, 51200, 102400],
    responseLengthBuckets: [512, 1024, 5120, 10240, 51200, 102400],
  }));

  // Request logging
  app.use((req: Request, res: Response, next: NextFunction) => {
    logger.info('Incoming request', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    next();
  });

  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Configure API routes
  configureRoutes(app);

  // Global error handling
  app.use(errorHandler);

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      status: 'error',
      message: 'Resource not found',
      path: req.path
    });
  });

  return app;
};

/**
 * Configure API routes with validation and security middleware
 */
function configureRoutes(app: Express): void {
  // Mount API routes with version prefix
  const apiRouter = express.Router();

  // Auth routes
  apiRouter.use('/auth', require('./routes/auth.routes'));

  // Background check routes
  apiRouter.use('/checks', require('./routes/background-check.routes'));

  // Document routes
  apiRouter.use('/documents', require('./routes/document.routes'));

  // Interview routes
  apiRouter.use('/interviews', require('./routes/interview.routes'));

  // Organization routes
  apiRouter.use('/organizations', require('./routes/organization.routes'));

  // User routes
  apiRouter.use('/users', require('./routes/user.routes'));

  // Mount API router with version prefix
  app.use('/api/v1', apiRouter);
}

// Export configured Express application
export const app = createApp();