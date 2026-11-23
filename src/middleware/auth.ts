import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { forbidden, unauthorized } from '../lib/errors';

export type Role = 'customer' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(user: AuthUser, secret: string, expiresIn: string): string {
  return jwt.sign({ email: user.email, role: user.role }, secret, {
    subject: user.id,
    expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
    issuer: 'shoplite-users-api',
  });
}

export function authenticate(secret: string): RequestHandler {
  return (req, _res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return next(unauthorized());
    try {
      const payload = jwt.verify(header.slice(7), secret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
      if (!payload.sub || (payload.role !== 'customer' && payload.role !== 'admin')) {
        return next(unauthorized('Invalid token'));
      }
      req.user = { id: payload.sub, email: String(payload.email), role: payload.role };
      next();
    } catch (err) {
      const expired = err instanceof jwt.TokenExpiredError;
      next(unauthorized(expired ? 'Token expired' : 'Invalid token'));
    }
  };
}

export function requireRole(role: Role): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (req.user.role !== role) return next(forbidden());
    next();
  };
}
