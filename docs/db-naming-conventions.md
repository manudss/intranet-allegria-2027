# Conventions de nommage — Base de données (PostgreSQL / TypeORM)

Ce document décrit les règles de nommage à respecter pour toute colonne, table, index ou contrainte du projet **intranet-allegria-2027**, afin de maintenir une cohérence avec le schéma existant.

---

## Règle principale : pas de `NamingStrategy` TypeORM

Le projet n'utilise **pas** de `SnakeNamingStrategy` ni aucune autre stratégie de nommage automatique.  
TypeORM utilise donc son comportement par défaut : **le nom de colonne SQL est identique au nom de propriété TypeScript**.

---

## Noms de tables

Les tables sont toujours en **snake_case** :

```
users, volunteers, volunteer_teams, volunteer_missions, volunteer_shifts, ...
```

---

## Noms de colonnes

### Colonnes régulières → **camelCase**

Toutes les colonnes qui portent de la donnée métier sont en **camelCase** dans la base de données :

| Propriété TypeScript | Colonne SQL attendue |
|---|---|
| `firstName` | `"firstName"` |
| `passwordHash` | `"passwordHash"` |
| `isActive` | `"isActive"` |
| `createdAt` | `"createdAt"` |
| `updatedAt` | `"updatedAt"` |
| `startAt` | `"startAt"` |
| `endAt` | `"endAt"` |
| `isOptional` | `"isOptional"` |

Dans les entités TypeORM, **ne pas ajouter** de `name:` sur ces colonnes — TypeORM utilise directement le nom de propriété :

```typescript
// ✅ Correct
@CreateDateColumn({ type: 'timestamptz' })
createdAt!: Date;

// ❌ Incorrect — name: redondant ou source de confusion
@CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
createdAt!: Date;
```

### Colonnes de clé étrangère → **snake_case**

Les colonnes FK (qui stockent l'ID d'une autre table) sont en **snake_case**, conformément à la migration initiale et au patron observé dans tout le schéma :

```typescript
// ✅ Correct — FK explicitement nommée en snake_case
@Column({ name: 'volunteer_team_id', type: 'int', nullable: true })
volunteerTeamId!: number | null;

@ManyToOne(...)
@JoinColumn({ name: 'volunteer_team_id' })
volunteerTeam!: VolunteerTeam | null;
```

Le `name: 'xxx_id'` est **obligatoire** sur les colonnes FK et les `@JoinColumn`.

---

## Résumé en un tableau

| Type de colonne | Convention SQL | `name:` dans l'entité |
|---|---|---|
| Colonne métier ordinaire | camelCase | Non — omis |
| Colonne de date (`createdAt`, etc.) | camelCase | Non — omis |
| Booléen (`isActive`, `isOptional`) | camelCase | Non — omis |
| Clé étrangère (`xxx_id`) | snake_case | **Oui — obligatoire** |
| Table (`volunteer_teams`) | snake_case | Dans `@Entity({ name: '...' })` |

---

## Migrations manuelles

Lors de la rédaction d'une migration SQL manuelle (CREATE TABLE, ALTER TABLE, etc.), respecter les mêmes règles :

```sql
-- ✅ Colonnes régulières en camelCase
CREATE TABLE "volunteer_missions" (
  "id" SERIAL NOT NULL,
  "title" character varying(200) NOT NULL,
  "volunteer_team_id" integer,          -- FK → snake_case
  "responsible_volunteer_id" integer,   -- FK → snake_case
  "isOptional" boolean NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "PK_volunteer_missions_id" PRIMARY KEY ("id")
);
```

---

## Noms d'index et de contraintes

Toujours utiliser des noms **explicites et descriptifs** (pas les noms hachés générés par TypeORM) :

```sql
-- ✅ Noms explicites
CONSTRAINT "PK_volunteer_teams_id" PRIMARY KEY ("id")
CONSTRAINT "uq_volunteer_teams_code" UNIQUE ("code")
CONSTRAINT "FK_volunteer_team_memberships_volunteer"
  FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id")
CREATE INDEX "IDX_volunteer_missions_status" ON "volunteer_missions" ("status")

-- ❌ Noms hachés auto-générés (à éviter)
CONSTRAINT "FK_608363acfb36882502e0e282ee8" FOREIGN KEY ...
```

Schéma de nommage recommandé :

| Type | Format |
|---|---|
| PK | `PK_{table}_id` |
| FK | `FK_{table}_{relation}` |
| Unique | `uq_{table}_{colonnes}` |
| Check | `CHK_{table}_{description}` |
| Index | `IDX_{table}_{colonne(s)}` |

---

## Migrations auto-générées

Les migrations générées par `migration:generate` utilisent par défaut les noms de propriétés TypeScript.  
Si elles entrent en conflit avec une migration manuelle existante, les convertir en **no-op** plutôt que de les supprimer (TypeORM doit pouvoir les marquer comme exécutées) :

```typescript
public async up(_queryRunner: QueryRunner): Promise<void> {
  // No-op: superseded by 1787310000000-CreateVolunteerTeams
}
public async down(_queryRunner: QueryRunner): Promise<void> {
  // No-op: see up().
}
```

