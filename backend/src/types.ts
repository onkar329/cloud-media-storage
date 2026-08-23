import { Request } from 'express';

export interface TokenUser {
  id: string;
  email: string;
  name?: string;
}

export interface AuthedRequest extends Request {
  user?: TokenUser;
}