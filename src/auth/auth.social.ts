import { SocialProvider } from '@prisma/client';

import { AppError } from '../utils/app-error';

// Social OAuth
// provider별 인가코드 → 액세스 토큰 교환 및 프로필 조회를 담당한다.
// 인가코드 교환은 클라이언트 시크릿이 필요하므로 반드시 서버에서만 수행한다 (보안 규칙).

// provider가 무엇이든 서비스가 동일하게 다루도록 정규화한 프로필
export interface SocialProfile {
  providerAccountId: string;
  email: string;
  nickname: string | null;
  profileImageUrl: string | null;
}

const OAUTH_TIMEOUT_MS = 10_000;

// provider 응답을 기다리다 요청이 무한정 매달리지 않도록 타임아웃을 건다.
const fetchWithTimeout = async (url: string, init: RequestInit) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OAUTH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const invalidCredential = () =>
  new AppError('AUTH_INVALID_CREDENTIAL', '소셜 인증에 실패했습니다.');

// 인가코드는 1회용이라 교환 실패 사유(만료·재사용·redirectUri 불일치)를 구분해 알려줄 실익이 없다.
// 어느 경우든 프론트는 다시 인증 플로우를 태워야 하므로 통합 메시지로 응답한다.
const exchangeToken = async (url: string, params: Record<string, string>) => {
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  if (!response.ok) {
    throw invalidCredential();
  }
  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw invalidCredential();
  }
  return data.access_token;
};

const fetchProfile = async (url: string, accessToken: string) => {
  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw invalidCredential();
  }
  return response.json();
};

// 구글 — userinfo 응답의 sub가 계정 고유 식별자
const getGoogleProfile = async (code: string, redirectUri: string): Promise<SocialProfile> => {
  const accessToken = await exchangeToken('https://oauth2.googleapis.com/token', {
    grant_type: 'authorization_code',
    code,
    client_id: process.env.GOOGLE_CLIENT_ID as string,
    client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
    redirect_uri: redirectUri,
  });

  const profile = (await fetchProfile(
    'https://www.googleapis.com/oauth2/v3/userinfo',
    accessToken,
  )) as { sub?: string; email?: string; name?: string; picture?: string };

  if (!profile.sub || !profile.email) {
    throw invalidCredential();
  }
  return {
    providerAccountId: profile.sub,
    email: profile.email,
    nickname: profile.name ?? null,
    profileImageUrl: profile.picture ?? null,
  };
};

// 네이버 — 프로필이 response 객체 안에 중첩되어 오고, id가 계정 고유 식별자
const getNaverProfile = async (code: string, redirectUri: string): Promise<SocialProfile> => {
  const accessToken = await exchangeToken('https://nid.naver.com/oauth2.0/token', {
    grant_type: 'authorization_code',
    code,
    client_id: process.env.NAVER_CLIENT_ID as string,
    client_secret: process.env.NAVER_CLIENT_SECRET as string,
    redirect_uri: redirectUri,
  });

  const body = (await fetchProfile('https://openapi.naver.com/v1/nid/me', accessToken)) as {
    response?: { id?: string; email?: string; nickname?: string; profile_image?: string };
  };

  const profile = body.response;
  if (!profile?.id || !profile.email) {
    throw invalidCredential();
  }
  return {
    providerAccountId: profile.id,
    email: profile.email,
    nickname: profile.nickname ?? null,
    profileImageUrl: profile.profile_image ?? null,
  };
};

// 기본 redirect URI — 프론트가 redirectUri를 보내지 않으면 서버 환경변수 값을 사용한다.
const defaultRedirectUri: Record<SocialProvider, string | undefined> = {
  google: process.env.GOOGLE_REDIRECT_URI,
  naver: process.env.NAVER_REDIRECT_URI,
};

export const getSocialProfile = async (
  provider: SocialProvider,
  code: string,
  redirectUri?: string,
): Promise<SocialProfile> => {
  const resolvedRedirectUri = redirectUri ?? defaultRedirectUri[provider];
  if (!resolvedRedirectUri) {
    throw new AppError('COMMON_INTERNAL_ERROR', '소셜 로그인 설정이 완료되지 않았습니다.');
  }

  return provider === 'google'
    ? getGoogleProfile(code, resolvedRedirectUri)
    : getNaverProfile(code, resolvedRedirectUri);
};
