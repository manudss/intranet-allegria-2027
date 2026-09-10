const DEFAULT_PORT = 3000;
const DEFAULT_CORS_ORIGIN = 'http://localhost:4200';
const VALID_NODE_ENVS = ['development', 'test', 'production'] as const;

type NodeEnv = (typeof VALID_NODE_ENVS)[number];

type EnvironmentInput = Record<string, unknown>;

const readString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const readPort = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value !== 'string' || value.trim().length === 0) return fallback;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`PORT must be a positive integer. Received "${value}".`);
  }

  return parsed;
};

const readNodeEnv = (value: unknown): NodeEnv => {
  const candidate = readString(value) ?? 'development';
  if ((VALID_NODE_ENVS as readonly string[]).includes(candidate)) return candidate as NodeEnv;

  throw new Error(
    `NODE_ENV must be one of ${VALID_NODE_ENVS.join(', ')}. Received "${candidate}".`,
  );
};

export const parseCorsOrigins = (value: string): string[] =>
  value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

export const validateEnvironment = (input: EnvironmentInput): EnvironmentInput => {
  const nodeEnv = readNodeEnv(input.NODE_ENV);
  const port = readPort(input.PORT, DEFAULT_PORT);
  const corsOrigin = readString(input.CORS_ORIGIN) ?? DEFAULT_CORS_ORIGIN;
  const databaseUrl =
    readString(input.DATABASE_URL) ?? readString(input.NEON_DATABASE_URL);
  const databaseUrlDirect = readString(input.DATABASE_URL_DIRECT);

  const localDatabaseConfig = {
    host: readString(input.DB_HOST),
    port: readString(input.DB_PORT),
    name: readString(input.DB_NAME),
    user: readString(input.DB_USER),
    password: readString(input.DB_PASSWORD),
  };

  const hasLocalDatabaseConfig = Object.values(localDatabaseConfig).every(Boolean);

  if (!databaseUrl && !hasLocalDatabaseConfig) {
    throw new Error(
      'Database configuration is missing. Define DATABASE_URL for Neon/hosted PostgreSQL or provide DB_HOST, DB_PORT, DB_NAME, DB_USER and DB_PASSWORD for local development.',
    );
  }

  if (nodeEnv === 'production' && !databaseUrl) {
    throw new Error('DATABASE_URL is required when NODE_ENV=production.');
  }

  if (parseCorsOrigins(corsOrigin).length === 0) {
    throw new Error('CORS_ORIGIN must contain at least one allowed origin.');
  }

  return {
    ...input,
    NODE_ENV: nodeEnv,
    PORT: port,
    CORS_ORIGIN: corsOrigin,
    DATABASE_URL: databaseUrl,
    DATABASE_URL_DIRECT: databaseUrlDirect,
  };
};

