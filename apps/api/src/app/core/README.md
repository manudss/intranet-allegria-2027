# Core API domains

This folder contains the first functional backend domains for Allegria 2027.

## Included modules

- `auth`: users, roles, login endpoint, role assignment and role-based guards
- `groups`: diocesan groups
- `participants`: participants CRUD with filters by `groupId` and `diocese`
- `volunteers`: volunteer profiles linked to users
- `teams`: teams CRUD and team participant listing
- `team-participants`: add/remove participants with team max-size enforcement
- `host-families`: host families CRUD
- `assignments`: participant-to-host-family assignments CRUD
- `participant-health`: restricted medical records separated from participant identity data

## Security note

`participant-health` endpoints are protected with `AuthTokenGuard` + `RoleGuard` and require role `ADMIN` or `HEALTH`.

## Quick local flow

1. Run migrations.
2. Create a user with role `ADMIN`.
3. Login with `/api/auth/login` and use `Authorization: Bearer <token>`.

