import http from 'http'; // @version built-in
import https from 'https'; // @version built-in
import fs from 'fs'; // @version built-in
import tls from 'tls'; // @version built-in
import { HealthCheck } from '@healthcheck/core'; // @version ^1.0.0

import app from './app';
import { WebSocketService } from './websocket/websocket.service';
import { logger } from './utils/logger';

// Environment variables with defaults
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const SSL_KEY_PATH = process.env.SSL_KEY_PATH;
const SSL_CERT_PATH = process.env.SSL_CERT_PATH;
const SHUTDOWN_TIMEOUT = parseInt(process.env.SHUTDOWN_TIMEOUT || '30000', 10);
const MAX_CONNECTIONS = parseInt(process.env.MAX_CONNECTIONS || '1000', 10);

/**
 * Creates and configures a production-ready HTTP/HTTPS server
 */
function createServer() {
  // Configure TLS options for production
  const tlsOptions = NODE_ENV === 'production' ? {
    key: fs.readFileSync(SSL_KEY_PATH!),
    cert: fs.readFileSync(SSL_CERT_PATH!),
    minVersion: 'TLSv1.2',
    ciphers: tls.DEFAULT_CIPHERS,
    honorCipherOrder: true,
    secureOptions: tls.SSL_OP_NO_SSLv3 | tls.SSL_OP_NO_TLSv1
  } : undefined;

  // Create appropriate server instance
  const server = NODE_ENV === 'production' 
    ? https.createServer(tlsOptions, app)
    : http.createServer(app);

  // Configure server timeouts
  server.timeout = 30000; // 30 seconds
  server.keepAliveTimeout = 65000; // 65 seconds (higher than ALB idle timeout)
  server.headersTimeout = 66000; // 66 seconds (slightly higher than keepAliveTimeout)

  // Set maximum number of listeners
  server.setMaxListeners(MAX_CONNECTIONS);

  return server;
}

/**
 * Configures graceful shutdown with connection draining
 */
function setupGracefulShutdown(server: http.Server | https.Server, wsService: WebSocketService) {
  let isShuttingDown = false;

  // Graceful shutdown handler
  async function shutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`${signal} received - initiating graceful shutdown`);

    // Stop accepting new connections
    server.close(async () => {
      try {
        // Get active connections
        const connections = wsService.getConnections();
        logger.info(`Active connections: ${connections.size}`);

        // Close WebSocket connections
        await wsService.shutdown();

        // Wait for ongoing requests to complete
        await new Promise(resolve => setTimeout(resolve, 5000));

        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', { error });
        process.exit(1);
      }
    });

    // Force shutdown after timeout
    setTimeout(() => {
      logger.error('Shutdown timeout reached - forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT);
  }

  // Register shutdown handlers
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

/**
 * Initializes and starts the server with comprehensive monitoring
 */
async function startServer() {
  try {
    // Initialize health check
    const healthCheck = new HealthCheck({
      path: '/health',
      timeout: 5000,
      healthyWhen: async () => ({ status: 'healthy' })
    });

    // Create server instance
    const server = createServer();

    // Initialize WebSocket service
    const wsService = new WebSocketService();
    await wsService.initialize();

    // Set up graceful shutdown
    setupGracefulShutdown(server, wsService);

    // Start listening
    server.listen(PORT, () => {
      logger.info('Server started', {
        port: PORT,
        environment: NODE_ENV,
        protocol: NODE_ENV === 'production' ? 'HTTPS' : 'HTTP'
      });
    });

    // Monitor server events
    server.on('error', (error) => {
      logger.error('Server error', { error });
    });

    server.on('clientError', (error) => {
      logger.error('Client error', { error });
    });

    // Track connections
    let connections = 0;
    server.on('connection', (socket) => {
      connections++;
      socket.on('close', () => {
        connections--;
      });

      // Prevent connection overload
      if (connections > MAX_CONNECTIONS) {
        socket.destroy();
        logger.warn('Connection limit reached - dropping connection');
      }
    });

    // Export server instance for testing
    return server;
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Start server if not being imported for testing
if (require.main === module) {
  startServer();
}

// Export server for testing
export { startServer };