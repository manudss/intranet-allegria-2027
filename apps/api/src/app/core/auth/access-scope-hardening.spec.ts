import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { ACCESS_LEVEL_KEY, ACCESS_MODULE_KEY, AccessScope } from './access-module.decorator';
import { JeunesRepartitionController } from '../jeunes-repartition/jeunes-repartition.controller';
import {
  AccessBadgesController,
  AccessConfigController,
  AccessGrantsController,
  AccessScanningController,
} from '../access-control/access-control.controllers';

class Dummy {
  route(@AccessScope() _scope: unknown) {
    return _scope;
  }
}

const meta = (target: object, method: string, key: string) =>
  new Reflector().get<string>(key, (target as Record<string, never>)[method]);

describe('Durcissement portée et migration des contrôleurs', () => {
  it('sans portée posée par la garde, la portée est vide (échec fermé)', () => {
    const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, Dummy, 'route');
    const factory = Object.values(args)[0] as { factory: (d: unknown, c: unknown) => unknown };
    const ctx = { switchToHttp: () => ({ getRequest: () => ({}) }) };
    expect(factory.factory(undefined, ctx)).toEqual({ all: false, groupIds: [] });
  });

  it('propose (simulation sans écriture) demande Voir, apply demande Modifier', () => {
    const proto = JeunesRepartitionController.prototype;
    expect(meta(proto, 'propose', ACCESS_LEVEL_KEY)).toBe('VIEW');
    expect(meta(proto, 'apply', ACCESS_LEVEL_KEY)).toBe('EDIT');
  });

  it('badges, configuration, droits scanner, audit et scan passent par la matrice', () => {
    const routes: [object, string, string][] = [
      [AccessBadgesController.prototype, 'assign', 'BADGES'],
      [AccessBadgesController.prototype, 'revoke', 'BADGES'],
      [AccessConfigController.prototype, 'createZone', 'BADGES'],
      [AccessGrantsController.prototype, 'audit', 'BADGES'],
      [AccessScanningController.prototype, 'decision', 'SCAN'],
    ];
    for (const [proto, method, mod] of routes) {
      if (typeof (proto as Record<string, unknown>)[method] === 'function') {
        expect(meta(proto, method, ACCESS_MODULE_KEY)).toBe(mod);
      }
    }
    const names = [
      AccessBadgesController,
      AccessConfigController,
      AccessGrantsController,
      AccessScanningController,
    ].flatMap((c) => Object.getOwnPropertyNames(c.prototype).filter((n) => n !== 'constructor'));
    const tagged = [
      AccessBadgesController,
      AccessConfigController,
      AccessGrantsController,
      AccessScanningController,
    ].flatMap((c) =>
      Object.getOwnPropertyNames(c.prototype)
        .filter((n) => n !== 'constructor')
        .map((n) =>
          Reflect.getMetadata(ACCESS_MODULE_KEY, (c.prototype as Record<string, never>)[n]),
        ),
    );
    expect(names.length).toBeGreaterThan(15);
    expect(tagged.every(Boolean)).toBe(true);
  });
});
