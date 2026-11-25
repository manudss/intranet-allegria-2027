import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { ACCESS_LEVEL_KEY, ACCESS_MODULE_KEY } from '../auth/access-module.decorator';
import { ProgramController } from './program.controller';

const proto = ProgramController.prototype as unknown as Record<string, () => void>;
const moduleOf = (method: string) => new Reflector().get<string>(ACCESS_MODULE_KEY, proto[method]);
const levelOf = (method: string) => new Reflector().get<string>(ACCESS_LEVEL_KEY, proto[method]);

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
  ])('%s exige le niveau Modifier sur le module Agenda', (method) => {
    expect(moduleOf(method)).toBe('AGENDA');
    expect(levelOf(method)).toBe('EDIT');
  });

  it.each(['getDay', 'getChangeLog'])(
    '%s est une lecture du module Agenda (niveau Voir par défaut)',
    (method) => {
      expect(moduleOf(method)).toBe('AGENDA');
      expect(levelOf(method)).toBeUndefined();
    },
  );
});
