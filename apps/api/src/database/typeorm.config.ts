import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import type { PostgresConnectionCredentialsOptions } from 'typeorm/driver/postgres/PostgresConnectionCredentialsOptions';
import { DataSource, DataSourceOptions } from 'typeorm';

const numberFromEnvironment = (value: string | undefined, fallback: number): number =>
  value ? Number(value) : fallback;

const sslFromEnvironment = (
  databaseUrl: string | undefined,
): PostgresConnectionCredentialsOptions['ssl'] =>
  process.env.DB_SSL === 'true' || Boolean(databaseUrl) ? { rejectUnauthorized: false } : undefined;

const createConnectionOptions = (
  databaseUrl: string | undefined,
): Pick<PostgresConnectionCredentialsOptions, 'url' | 'host' | 'port' | 'ssl'> =>
  databaseUrl
    ? {
        url: databaseUrl,
        ssl: sslFromEnvironment(databaseUrl),
      }
    : {
        host: process.env.DB_HOST ?? 'localhost',
        port: numberFromEnvironment(process.env.DB_PORT, 5432),
        ssl: sslFromEnvironment(databaseUrl),
      };

export const createTypeOrmOptions = (configService: ConfigService): TypeOrmModuleOptions => {
  const databaseUrl =
    configService.get<string>('DATABASE_URL') ?? configService.get<string>('NEON_DATABASE_URL');

  return {
    type: 'postgres',
    database: configService.get<string>('DB_NAME', 'mej_allegria'),
    username: configService.get<string>('DB_USER', 'mej_user'),
    password: configService.get<string>('DB_PASSWORD', 'mej_password'),
    autoLoadEntities: true,
    synchronize: false,
    ...createConnectionOptions(databaseUrl),
  };
};

// DataSource used by the TypeORM CLI for migrations.
const migrationOptions: DataSourceOptions = {
  type: 'postgres',
  database: process.env.DB_NAME ?? 'mej_allegria',
  username: process.env.DB_USER ?? 'mej_user',
  password: process.env.DB_PASSWORD ?? 'mej_password',
  entities: ['apps/api/src/**/*.entity.ts'],
  migrations: ['apps/api/src/database/migrations/*.ts'],
  synchronize: false,
  ...createConnectionOptions(process.env.DATABASE_URL ?? process.env.NEON_DATABASE_URL),
};

export default new DataSource(migrationOptions);
