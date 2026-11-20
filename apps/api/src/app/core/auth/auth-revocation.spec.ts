import { it, expect } from 'vitest';
import { AuthService } from './auth.service';
import { hashPassword } from './password.util';
it('rejects an already-issued bearer after its account is disabled and reloads role revocations', async () => {
  let active = true,
    roles = ['HEALTH'];
  const user = {
    id: 1,
    email: 'fiction@example.test',
    isActive: true,
    passwordHash: hashPassword('fiction-only'),
  };
  const service = new AuthService(
    { findOneBy: async () => ({ ...user, isActive: active }) } as never,
    { find: async () => roles.map((code) => ({ role: { code } })) } as never,
    {} as never,
  );
  const session = await service.login({ email: user.email, password: 'fiction-only' });
  expect((await service.resolveToken(session.accessToken))?.roles).toEqual(['HEALTH']);
  roles = [];
  expect((await service.resolveToken(session.accessToken))?.roles).toEqual([]);
  active = false;
  expect(await service.resolveToken(session.accessToken)).toBeNull();
  active = true;
  expect(await service.resolveToken(session.accessToken)).toBeNull();
});
