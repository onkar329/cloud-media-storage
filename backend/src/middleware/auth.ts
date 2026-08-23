import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthedRequest, TokenUser } from '../types';

export const auth = (req: AuthedRequest, res: Response, next: NextFunction) => {
  const token = req.cookies?.access_token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as TokenUser;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
  }
};