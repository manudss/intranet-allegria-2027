# Core API domains

This folder contains the first functional backend domains for Allegria 2027.

## Included modules

- `auth`: users, roles, login endpoint, role assignment and role-based guards
- `groups`: diocesan groups
- `participants`: participants CRUD with filters by `groupId` and `diocese`
- `volunteers`: volunteer profiles linked to users
- `volunteer-teams`: operational volunteer teams and memberships
- `teams`: teams CRUD and team participant listing
- `team-participants`: add/remove participants with team max-size enforcement
- `host-families`: host families CRUD
- `assignments`: participant-to-host-family assignments CRUD
- `participant-health`: restricted medical records separated from participant identity data

## Security note

`participant-health` endpoints are protected with `AuthTokenGuard` + `RoleGuard` and require role `ADMIN` or `HEALTH`.
`volunteer-teams` endpoints are protected with `AuthTokenGuard` + `RoleGuard` and require write roles `ADMIN|COORDINATOR` for mutations, plus read roles `ADMIN|COORDINATOR|HEALTH|VOLUNTEERS|LOGISTICS|VIEWER` for reads.

## Swagger

- Swagger UI is exposed at `/api/docs`
- Login once via `/api/auth/login`, then use `Authorize` with `Bearer <token>`

## Seed data

- Seed runner: `apps/api/src/database/seeds/seed.ts`
- Profiles: `small`, `medium`, `large`
- The seed is deterministic and regenerates coherent test data with edge cases and volume.

## Quick local flow

1. Run migrations.
2. Run one seed profile.
3. Open `/api/docs` and test the API with generated accounts.
