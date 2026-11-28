import { describe, expect, it } from 'vitest';
import { DEFAULT_ACCESS_RULES } from './access-defaults';
import { SplitPersonNotesAccess1791200000000 } from '../../../database/migrations/1791200000000-SplitPersonNotesAccess';

describe('droit PERSON_NOTES séparé de PARTICIPANTS', () => {
  const key = (r: { subjectKind: string; subjectKey: string }) => `${r.subjectKind}:${r.subjectKey}`;

  it('chaque sujet a PERSON_NOTES au même niveau et portée que PARTICIPANTS, et seulement lui', () => {
    const participants = new Map(
      DEFAULT_ACCESS_RULES.filter((r) => r.module === 'PARTICIPANTS').map((r) => [key(r), r]),
    );
    const notes = DEFAULT_ACCESS_RULES.filter((r) => r.module === 'PERSON_NOTES');
    expect(notes.length).toBe(participants.size);
    for (const n of notes) {
      const p = participants.get(key(n));
      expect(p, `PERSON_NOTES sans PARTICIPANTS pour ${key(n)}`).toBeDefined();
      expect(n.level).toBe(p!.level);
      expect(n.scope).toBe(p!.scope);
    }
  });

  it('la migration copie sans rien modifier ni supprimer, est idempotente, et son retour ne touche que PERSON_NOTES', async () => {
    const queries: string[] = [];
    const qr = { query: async (sql: string) => void queries.push(sql) } as never;
    const m = new SplitPersonNotesAccess1791200000000();
    await m.up(qr);
    expect(queries).toHaveLength(2);
    const up = queries.join('\n');
    expect(up).toMatch(/ON CONFLICT \("subject_kind", "subject_key", "module"\) DO NOTHING/);
    expect(up).toMatch(/NOT EXISTS/);
    expect(up).not.toMatch(/\bUPDATE\b|\bDELETE\b|\bDROP\b/i);
    expect(up).toMatch(/WHERE "module" = 'PARTICIPANTS'/);
    queries.length = 0;
    await m.down(qr);
    expect(queries).toHaveLength(2);
    for (const q of queries) {
      expect(q).toMatch(/DELETE FROM/);
      expect(q).toMatch(/"module" = 'PERSON_NOTES'/);
      expect(q).not.toMatch(/PARTICIPANTS/);
    }
  });
});
