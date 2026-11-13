import {describe,it,expect} from 'vitest';
import { QR_TEST_ACCOUNTS,qrTestDates } from './access-testkit';
describe('QR seed testkit',()=>{
  it('anchors usable grants to reseed time rather than the future event date',()=>{const now=new Date('2026-11-13T10:00:00Z');const dates=qrTestDates(now);expect(dates.grantFrom<now).toBe(true);expect(dates.grantUntil>now).toBe(true);expect(dates.expired<now).toBe(true);expect(dates.activeUntil>now).toBe(true);});
  it('separates manager, two scanners, limited/expired/revoked/no-grant/no-role accounts',()=>{expect(new Set(QR_TEST_ACCOUNTS.map(x=>x.email)).size).toBe(8);expect(QR_TEST_ACCOUNTS.filter(x=>x.scope==='all')).toHaveLength(2);expect(QR_TEST_ACCOUNTS.find(x=>x.scope==='meal')?.roles).toContain('SCANNER');expect(QR_TEST_ACCOUNTS.find(x=>x.email.includes('manager'))?.roles).not.toContain('SCANNER');expect(QR_TEST_ACCOUNTS.some(x=>x.roles.length===0)).toBe(true);});
});
