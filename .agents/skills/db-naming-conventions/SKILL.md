# SKILL.md — Conventions de nommage Base de données

## Description

Ce skill s'applique dès qu'on touche à la base de données du projet : création d'entité TypeORM, écriture d'une migration SQL, ajout de colonne, d'index ou de contrainte.

Il garantit la cohérence avec le schéma existant et évite les erreurs de type `column "xxx" does not exist`.

## Règles fondamentales

### 1. Pas de NamingStrategy automatique

Le projet n'utilise **pas** de `SnakeNamingStrategy`. TypeORM utilise le nom de propriété TypeScript tel quel comme nom de colonne SQL.

**Ne jamais ajouter** `namingStrategy` dans `typeorm.config.ts`.

### 2. Colonnes régulières → camelCase

Les colonnes métier ordinaires doivent être en camelCase **dans la base de données** :

- `createdAt`, `updatedAt`, `startAt`, `endAt`
- `isActive`, `isOptional`, `isGroupLeader`
- `firstName`, `lastName`, `passwordHash`, `maxCapacity`

Dans l'entité TypeORM : **omettre** le `name:` optionnel sur ces colonnes.

```typescript
// ✅
@CreateDateColumn({ type: 'timestamptz' })
createdAt!: Date;

// ❌ name: redondant ou incorrect
@CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
createdAt!: Date;
```

### 3. Colonnes FK → snake_case avec `name:` obligatoire

Les colonnes de clé étrangère (`*_id`) sont en **snake_case** et nécessitent un `name:` explicite :

```typescript
// ✅
@Column({ name: 'volunteer_team_id', type: 'int', nullable: true })
volunteerTeamId!: number | null;

@JoinColumn({ name: 'volunteer_team_id' })
volunteerTeam!: VolunteerTeam | null;
```

### 4. Noms de tables → snake_case dans `@Entity`

```typescript
@Entity({ name: 'volunteer_missions' })
export class VolunteerMission { ... }
```

### 5. Migrations manuelles

Écrire les colonnes régulières en camelCase dans le SQL :

```sql
CREATE TABLE "volunteer_missions" (
  "id" SERIAL NOT NULL,
  "volunteer_team_id" integer,   -- FK snake_case
  "isOptional" boolean NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ...
);
```

### 6. Noms d'index et contraintes

Toujours utiliser des noms descriptifs, jamais les hachés TypeORM :

| Type   | Patron                      |
| ------ | --------------------------- |
| PK     | `PK_{table}_id`             |
| FK     | `FK_{table}_{relation}`     |
| Unique | `uq_{table}_{colonnes}`     |
| Check  | `CHK_{table}_{description}` |
| Index  | `IDX_{table}_{colonne}`     |

## Référence complète

Voir [`docs/db-naming-conventions.md`](../../../../docs/db-naming-conventions.md) pour les exemples exhaustifs et le tableau récapitulatif complet.
