import { ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { CreateScannerGrantDto, CreateZoneDto, LookupCodeDto, RegisterBadgeStockDto, UpdateZoneDto, UploadScansDto } from './access-control.types';
const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
const parse = (metatype: new () => object, value: unknown) => pipe.transform(value, { type: 'body', metatype });
describe('Access-control input validation', () => {
  it('validates nested scans and bounds the batch size', async () => {
    await expect(parse(UploadScansDto, { scans: [{ code: 'abc', pointId: 3, clientEventId: 'event-1' }] })).resolves.toBeDefined();
    await expect(parse(UploadScansDto, { scans: [{ code: 'abc', pointId: -3, clientEventId: 'event-1' }] })).rejects.toThrow();
    await expect(parse(UploadScansDto, { scans: Array(501).fill({}) })).rejects.toThrow();
    await expect(parse(UploadScansDto, { scans: [{ code: 'abc', pointId: 3, clientEventId: 'x', unexpected: true }] })).rejects.toThrow();
  });
  it('rejects invalid dates, boolean strings and enum values', async () => {
    await expect(parse(CreateScannerGrantDto, { userId: 1, endsAt: 'garbage' })).rejects.toThrow();
    await expect(parse(CreateZoneDto, { name: 'Zone', requiresOnlineValidation: 'false' })).rejects.toThrow();
    await expect(parse(CreateZoneDto, { name: 'Zone', allowedPersonTypes: ['ADMIN'] })).rejects.toThrow();
  });
  it('requires a lot and bounds opaque codes and IDs', async () => {
    await expect(parse(RegisterBadgeStockDto, { codes: ['abc'] })).rejects.toThrow();
    await expect(parse(LookupCodeDto, { code: 'x'.repeat(65), pointId: 1 })).rejects.toThrow();
    await expect(parse(LookupCodeDto, { code: 'abc', pointId: 0 })).rejects.toThrow();
  });
  it('uses a real PartialType for zone patch', async () => {
    await expect(parse(UpdateZoneDto, { requiresOnlineValidation: true })).resolves.toBeDefined();
    await expect(parse(UpdateZoneDto, { maxOfflineMinutes: -1 })).rejects.toThrow();
  });
});
