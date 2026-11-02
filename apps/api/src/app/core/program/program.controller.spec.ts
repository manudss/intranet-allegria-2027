import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { ROLES_KEY } from '../auth/roles.decorator';
import { ProgramController } from './program.controller';

const proto = ProgramController.prototype as unknown as Record<string, () => void>;
const rolesOf = (method: string) => new Reflector().get<string[]>(ROLES_KEY, proto[method]);

describe('ProgramController — rôles', () => {
  it.each([
    'create',
    'update',
    'remove',
    'previewInsert',
    'applyInsert',
    'previewResize',
    'applyResize',
    'freeze',
    'unfreeze',
  ])(
    '%s est réservé à ADMIN/COORDINATOR',
    (method) => {
      expect(rolesOf(method)).toEqual(['ADMIN', 'COORDINATOR']);
    },
  );

  it.each(['getDay', 'getChangeLog'])(
    '%s est ouvert en lecture aux rôles du dashboard',
    (method) => {
      const roles = rolesOf(method);
      expect(roles).toEqual(expect.arrayContaining(['ADMIN', 'COORDINATOR', 'VIEWER']));
    },
  );
});
