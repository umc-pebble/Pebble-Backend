import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';

// 토큰 정책의 단일 소스 — access 1h / refresh 14d (보안 규칙)
// payload 형식 { userId }는 auth.middleware의 검증 형식과 반드시 일치해야 한다.

export interface TokenPayload {
  userId: number;
}

export const signAccessToken = (userId: number) =>
  jwt.sign({ userId }, process.env.JWT_SECRET as string, {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '1h') as SignOptions['expiresIn'],
    jwtid: crypto.randomUUID(),
  });

// jwtid(jti)로 매 발급마다 고유성 보장 — iat이 초 단위라 같은 초에 재발급하면
// jti 없이는 토큰이 동일해져 회전(rotation)이 무력화된다.
export const signRefreshToken = (userId: number) =>
  jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET as string, {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? '14d') as SignOptions['expiresIn'],
    jwtid: crypto.randomUUID(),
  });

// 만료/변조 시 jsonwebtoken이 throw — 호출부(service)에서 AppError로 변환한다.
export const verifyRefreshToken = (token: string) =>
  jwt.verify(token, process.env.JWT_REFRESH_SECRET as string) as TokenPayload;

// refresh 토큰은 DB에 원문 대신 sha256 해시로 저장한다 (DB 유출 시 토큰 탈취 방지)
export const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
