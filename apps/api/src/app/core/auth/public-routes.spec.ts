import 'reflect-metadata';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { AppController } from '../../app.controller';
import { HostFamiliesController } from '../host-families/host-families.controller';
import { GroupsController } from '../groups/groups.controller';
import { ParticipantsController } from '../participants/participants.controller';
import { PublicHostFamilyRegistrationsController } from '../public-registrations/public-host-family-registrations.controller';
import { PublicParticipantRegistrationsController } from '../public-registrations/public-participant-registrations.controller';
import { PublicVolunteerApplicationsController } from '../public-registrations/public-volunteer-applications.controller';
import { RolesController } from './roles.controller';
import { UsersController } from './users.controller';
import { AuthController } from './auth.controller';
import { GlobalAuthGuard } from './global-auth.guard';
import { AuthTokenGuard } from './auth-token.guard';
import { IS_PUBLIC_KEY } from './public.decorator';

type Ctor = new (...args: never[]) => unknown;
const reflector = new Reflector();

const routesOf = (controller: Ctor) =>
  Object.getOwnPropertyNames(controller.prototype)
    .filter((name) => Reflect.hasMetadata(METHOD_METADATA, controller.prototype[name as never]))
    .map((name) => {
      const handler = controller.prototype[name as never] as object;
      const method = RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler)];
      const base = Reflect.getMetadata(PATH_METADATA, controller) ?? '';
      const path = Reflect.getMetadata(PATH_METADATA, handler) ?? '';
      const isPublic = Boolean(
        reflector.getAllAndOverride(IS_PUBLIC_KEY, [handler as never, controller]),
      );
      return {
        route: `${method} /${[base, path].filter((p) => p && p !== '/').join('/')}`,
        isPublic,
      };
    });

const all: Ctor[] = [
  AppController,
  AuthController,
  UsersController,
  RolesController,
  ParticipantsController,
  GroupsController,
  HostFamiliesController,
  PublicParticipantRegistrationsController,
  PublicHostFamilyRegistrationsController,
  PublicVolunteerApplicationsController,
];

describe('public routes allow-list', () => {
  it('only exposes health, login and the three POST-only registration endpoints', () => {
    const publicRoutes = all
      .flatMap(routesOf)
      .filter((r) => r.isPublic)
      .map((r) => r.route)
      .sort();

    expect(publicRoutes).toEqual(
      [
        'GET /',
        'GET /health',
        'POST /auth/login',
        'POST /public/host-family-registrations',
        'POST /public/participant-registrations',
        'POST /public/volunteer-applications',
      ].sort(),
    );
  });

  it('keeps participant, user, group and host family routes protected', () => {
    const protectedControllers = [
      ParticipantsController,
      GroupsController,
      HostFamiliesController,
      UsersController,
      RolesController,
    ];
    for (const controller of protectedControllers) {
      const routes = routesOf(controller);
      expect(routes.length).toBeGreaterThan(0);
      expect(routes.every((r) => !r.isPublic)).toBe(true);
    }
  });
});

describe('GlobalAuthGuard', () => {
  const contextFor = (handler: object, controller: object, authorization?: string) =>
    ({
      getHandler: () => handler,
      getClass: () => controller,
      switchToHttp: () => ({ getRequest: () => ({ headers: { authorization } }) }),
    }) as never;

  const resolver = (user: unknown) =>
    new AuthTokenGuard({ resolveToken: async () => user } as never);

  it('rejects a protected route without a token', async () => {
    const guard = new GlobalAuthGuard(reflector, resolver(null));
    const handler = ParticipantsController.prototype.search;
    await expect(guard.canActivate(contextFor(handler, ParticipantsController))).rejects.toThrow(
      'Token manquant',
    );
  });

  it('rejects an unknown token', async () => {
    const guard = new GlobalAuthGuard(reflector, resolver(null));
    const handler = ParticipantsController.prototype.search;
    await expect(
      guard.canActivate(contextFor(handler, ParticipantsController, 'Bearer nope')),
    ).rejects.toThrow('Token invalide');
  });

  it('accepts a valid token', async () => {
    const guard = new GlobalAuthGuard(reflector, resolver({ id: 1, email: 'a', roles: [] }));
    const handler = ParticipantsController.prototype.search;
    await expect(
      guard.canActivate(contextFor(handler, ParticipantsController, 'Bearer ok')),
    ).resolves.toBe(true);
  });

  it('lets public routes through without a token', async () => {
    const guard = new GlobalAuthGuard(reflector, resolver(null));
    const handler = AuthController.prototype.login;
    await expect(guard.canActivate(contextFor(handler, AuthController))).resolves.toBe(true);
  });
});
