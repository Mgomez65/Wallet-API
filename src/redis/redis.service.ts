import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis(
      config.get<string>('REDIS_URL', 'redis://localhost:6379'),
      {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      },
    );
  }

  async get(key: string): Promise<string | null> {
    try {
      if (this.client.status === 'wait') await this.client.connect();
      return await this.client.get(key);
    } catch {
      return null;
    }
  }

  async setEx(key: string, seconds: number, value: string): Promise<void> {
    try {
      if (this.client.status === 'wait') await this.client.connect();
      await this.client.set(key, value, 'EX', seconds);
    } catch {
      return;
    }
    return;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.status !== 'end') await this.client.quit();
  }
}
