import 'dotenv/config';
import type { EntityManager } from 'typeorm';
import {
  insertProgramDemoDay,
  PROGRAM_SEED_DAYS,
  ProgramSeedDay,
} from '../../app/core/program/program-demo-seed';
import { ProgramSequence, User, VolunteerTeam } from '../../app/core/entities';

/**
 * Peuplement du programme pour une base de PREVIEW (branche Neon propre à la PR), sans rien supprimer.
 *
 * - Ajoute le programme fictif des jours qui n'ont AUCUNE séquence ; un jour déjà renseigné (ex. un créneau
 *   saisi à la main pendant les tests) n'est jamais modifié ni remplacé.
 * - Ne tourne que si PREVIEW_SEED_PROGRAM=true (variable posée uniquement par le pipeline de preview). Sans cette
 *   variable (installation, production), le script ne fait rien : l'application s'installe sans donnée.
 * - Idempotent : relancé, il ne crée rien de plus.
 */
export const previewProgramSeedEnabled = (env: NodeJS.ProcessEnv): boolean =>
  env['PREVIEW_SEED_PROGRAM'] === 'true';

export async function fillEmptyProgramDays(
  manager: EntityManager,
  days: ProgramSeedDay[] = PROGRAM_SEED_DAYS,
): Promise<{ filled: string[]; skipped: string[] }> {
  const filled: string[] = [];
  const skipped: string[] = [];
  const teams = await manager.find(VolunteerTeam, { where: { isActive: true }, order: { id: 'ASC' } });
  const coordinator = await manager.findOne(User, { where: { email: 'coordination@allegria.local' } });
  const teamCursor = { value: 0 };
  for (const day of days) {
    const existing = await manager.count(ProgramSequence, { where: { eventDate: day.eventDate } });
    if (existing > 0) {
      skipped.push(day.eventDate);
      continue;
    }
    await insertProgramDemoDay(manager, day, {
      teamIds: teams.map((team) => team.id),
      coordinatorId: coordinator?.id ?? null,
      teamCursor,
    });
    filled.push(day.eventDate);
  }
  return { filled, skipped };
}

async function run(): Promise<void> {
  if (!previewProgramSeedEnabled(process.env)) {
    console.log('[seed-preview-program] PREVIEW_SEED_PROGRAM is not "true": nothing to do.');
    return;
  }
  const { default: dataSource } = await import('../typeorm.config');
  await dataSource.initialize();
  try {
    const result = await dataSource.transaction((manager) => fillEmptyProgramDays(manager));
    console.log(
      `[seed-preview-program] filled: ${result.filled.join(', ') || 'none'}; left untouched (already had data): ${result.skipped.join(', ') || 'none'}`,
    );
  } finally {
    await dataSource.destroy();
  }
}

if (process.argv[1]?.endsWith('seed-preview-program.ts')) {
  run().catch((error) => {
    console.error('[seed-preview-program] failed', error);
    process.exit(1);
  });
}
