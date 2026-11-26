import { describe, expect, it } from 'vitest';
import { ValidationPipe } from '@nestjs/common';
import {
  ApplyAssignmentsDto,
  CreateGroupDto,
  CreateRepartitionDto,
  SetManagersDto,
  SetOverflowDto,
} from './gathering-groups.types';

// Le contrôleur applique un ValidationPipe whitelist : chaque propriété acceptée
// doit porter un décorateur class-validator, sans quoi elle est rejetée.
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

describe('gathering-groups DTO (validation whitelist)', () => {
  it('accepte allowOverflow sur la dérogation', async () => {
    const dto = await pipe.transform(
      { allowOverflow: true },
      { type: 'body', metatype: SetOverflowDto },
    );
    expect(dto.allowOverflow).toBe(true);
  });

  it('accepte une répartition avec événement et notes', async () => {
    const dto = await pipe.transform(
      { name: 'Repas du soir', programSequenceId: 12, notes: 'Par lieux' },
      { type: 'body', metatype: CreateRepartitionDto },
    );
    expect(dto.name).toBe('Repas du soir');
    expect(dto.programSequenceId).toBe(12);
  });

  it('accepte un groupe avec catégorie, capacité et lieu', async () => {
    const dto = await pipe.transform(
      { name: 'Vikings', category: 'TA', capacityPersons: 60, location: 'Grand terrain' },
      { type: 'body', metatype: CreateGroupDto },
    );
    expect(dto.capacityPersons).toBe(60);
    expect(dto.category).toBe('TA');
  });

  it('accepte une liste de responsables', async () => {
    const dto = await pipe.transform(
      { userIds: [4, 9] },
      { type: 'body', metatype: SetManagersDto },
    );
    expect(dto.userIds).toEqual([4, 9]);
  });

  it('accepte des affectations, groupId null compris', async () => {
    const dto = await pipe.transform(
      { assignments: [{ teamId: 12, groupId: 3 }, { teamId: 13, groupId: null }] },
      { type: 'body', metatype: ApplyAssignmentsDto },
    );
    expect(dto.assignments).toHaveLength(2);
    expect(dto.assignments[1].groupId).toBeNull();
  });

  it('rejette une propriété inconnue', async () => {
    await expect(
      pipe.transform({ allowOverflow: true, autre: 1 }, { type: 'body', metatype: SetOverflowDto }),
    ).rejects.toThrow();
  });

  it('rejette une catégorie hors enum', async () => {
    await expect(
      pipe.transform({ name: 'X', category: 'SCOUT' }, { type: 'body', metatype: CreateGroupDto }),
    ).rejects.toThrow();
  });
});
