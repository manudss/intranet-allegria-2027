import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class AppService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  getData(): { message: string } {
    return { message: 'Hello API' };
  }

  async getHealth(): Promise<{ status: 'ok'; environment: string; database: 'up' }> {
    try {
      await this.dataSource.query('SELECT 1');
    } catch (error) {
      throw new ServiceUnavailableException('Database connection is unavailable.');
    }

    return {
      status: 'ok',
      environment: process.env.NODE_ENV ?? 'development',
      database: 'up',
    };
  }
}
