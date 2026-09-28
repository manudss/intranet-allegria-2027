import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PublicHostFamilyRegistrationsController } from './public-host-family-registrations.controller';
import { PublicRegistrationsService } from './public-registrations.service';

const payload = {
  familyName: 'Famille Bernard',
  address: '12 rue des Tilleuls',
  postalCode: '42000',
  city: 'Saint-Étienne',
  phone: '+33601020304',
  email: 'bernard@example.fr',
  maxCapacity: 4,
  maxUnder18: 3,
};

describe('POST /api/public/host-family-registrations', () => {
  let app: INestApplication;
  let url: string;
  const service = { createHostFamilyRegistration: vi.fn() };
  beforeEach(async () => {
    service.createHostFamilyRegistration.mockReset().mockResolvedValue({ status: 'DRAFT' });
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 600_000, limit: 5 }])],
      controllers: [PublicHostFamilyRegistrationsController],
      providers: [{ provide: PublicRegistrationsService, useValue: service }],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    url = `${await app.getUrl()}/api/public/host-family-registrations`;
  });
  afterEach(async () => {
    await app?.close();
  });
  const post = (body: unknown) =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('est accessible sans authentification et renvoie 201 après validation', async () => {
    const response = await post(payload);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ status: 'DRAFT' });
    expect(service.createHostFamilyRegistration).toHaveBeenCalledWith(payload);
  });
  it('ne persiste pas les soumissions du honeypot', async () => {
    const response = await post({ ...payload, honeypot: 'bot' });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ status: 'DRAFT' });
    expect(service.createHostFamilyRegistration).not.toHaveBeenCalled();
  });
  it('refuse les champs administratifs et capacités invalides avant le service', async () => {
    expect((await post({ ...payload, status: 'VALIDATED' })).status).toBe(400);
    expect((await post({ ...payload, maxUnder18: 5 })).status).toBe(400);
    expect(service.createHostFamilyRegistration).not.toHaveBeenCalled();
  });
  it('limite les requêtes à cinq par dix minutes', async () => {
    for (let i = 0; i < 5; i++) expect((await post(payload)).status).toBe(201);
    expect((await post(payload)).status).toBe(429);
    expect(service.createHostFamilyRegistration).toHaveBeenCalledTimes(5);
  });
});
