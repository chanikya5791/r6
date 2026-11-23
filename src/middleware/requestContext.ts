import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { log } from '../lib/logger';

/** Adds an X-Request-Id to every request/response and logs one line per request. */
export const requestContext: RequestHandler = (req, res, next) => {
  const requestId = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-Id', requestId);
  const started = Date.now();
  res.on('finish', () => {
    if (req.path === '/health') return;
    log.info('request', {
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - started,
    });
  });
  next();
};
