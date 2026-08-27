import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';

const numberFromEnvironment = (value: string | undefined, fallback: number): number =>
  value ? Number(value) : fallback;

export const createTypeOrmOptions = (configService: ConfigService): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get<string>('DB_HOST', 'localhost'),
  port: numberFromEnvironment(configService.get<string>('DB_PORT'), 5432),
  database: configService.get<string>('DB_NAME', 'mej_allegria'),
  username: configService.get<string>('DB_USER', 'mej_user'),
  password: configService.get<string>('DB_PASSWORD', 'mej_password'),
  autoLoadEntities: true,
  synchronize: false,
});

// DataSource used by the TypeORM CLI for migrations.
const migrationOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: numberFromEnvironment(process.env.DB_PORT, 5432),
  database: process.env.DB_NAME ?? 'mej_allegria',
  username: process.env.DB_USER ?? 'mej_user',
  password: process.env.DB_PASSWORD ?? 'mej_password',
  entities: ['apps/api/src/**/*.entity.ts'],
  migrations: ['apps/api/src/database/migrations/*.ts'],
  synchronize: false,
};

export default new DataSource(migrationOptions);

