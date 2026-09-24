import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { Request, Response, NextFunction } from 'express';
import type { Role } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

const jwtSecret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');
  return process.env.JWT_SECRET;
};

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signToken(user: { id: number; email: string; role: Role }) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, jwtSecret(), { expiresIn: '8h' });
}

export type AuthRequest = Request & { user?: { id: number; email: string; role: Role } };

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
  try {
    const payload = jwt.verify(header.slice(7), jwtSecret()) as jwt.JwtPayload;
    if (!payload.sub || !payload.email || !payload.role) throw new Error('Invalid token');
    req.user = { id: Number(payload.sub), email: String(payload.email), role: payload.role as Role };
    next();
  } catch {
    return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } });
  }
}

export function requireRoles(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    next();
  };
}
