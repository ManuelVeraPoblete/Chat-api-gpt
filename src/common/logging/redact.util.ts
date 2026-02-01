// src/common/logging/redact.util.ts
const SENSITIVE_KEYS = [
  'password',
  'passwordHash',
  'refreshToken',
  'refreshTokenHash',
  'accessToken',
  'token',
  'authorization',
  'apiKey',
  'secret',
];

export function redactDeep<T>(input: T): T {
  if (input === null || input === undefined) return input;

  if (Array.isArray(input)) return input.map(redactDeep) as unknown as T;

  if (typeof input === 'object') {
    const obj = input as Record<string, any>;
    const out: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      const lower = key.toLowerCase();
      if (SENSITIVE_KEYS.some((k) => lower.includes(k))) out[key] = '[REDACTED]';
      else out[key] = redactDeep(value);
    }

    return out as T;
  }

  return input;
}

export function summarizeResult(input: any, maxItems = 5): any {
  if (input === null || input === undefined) return input;

  if (Array.isArray(input)) {
    return { type: 'array', total: input.length, sample: input.slice(0, maxItems).map(redactDeep) };
  }

  if (typeof input === 'object') {
    const entries = Object.entries(input).slice(0, 20);
    return { type: 'object', sample: redactDeep(Object.fromEntries(entries)) };
  }

  return input;
}
