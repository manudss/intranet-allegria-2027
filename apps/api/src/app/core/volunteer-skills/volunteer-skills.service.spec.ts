import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { VolunteerSkillType } from '../entities';
import { VolunteerSkillsService } from './volunteer-skills.service';

const makeService = (overrides: {
  skillsRepository?: object;
  tagsRepository?: object;
  volunteersRepository?: object;
  membershipsRepository?: object;
}) => {
  const skillsRepository = overrides.skillsRepository ?? {};
  const tagsRepository = overrides.tagsRepository ?? {};
  const volunteersRepository = overrides.volunteersRepository ?? {};
  const membershipsRepository = overrides.membershipsRepository ?? {};
  return new VolunteerSkillsService(
    skillsRepository as never,
    tagsRepository as never,
    volunteersRepository as never,
    membershipsRepository as never,
  );
};

const adminUser = { id: 1, email: 'admin@test.com', roles: ['ADMIN'] };
const coordinatorUser = { id: 2, email: 'coord@test.com', roles: ['COORDINATOR'] };
const viewerUser = { id: 3, email: 'viewer@test.com', roles: ['VIEWER'] };
const volunteerUser = { id: 10, email: 'vol@test.com', roles: ['VOLUNTEERS'] };
const healthUser = { id: 11, email: 'health@test.com', roles: ['HEALTH'] };
const logisticsUser = { id: 12, email: 'log@test.com', roles: ['LOGISTICS'] };

describe('VolunteerSkillsService — addSkill', () => {
  it('ajoute une compétence pour ADMIN', async () => {
    const saved = { id: 1, volunteerId: 5, skill: VolunteerSkillType.ANIMATION };
    const service = makeService({
      volunteersRepository: { findOneBy: vi.fn().mockResolvedValue({ id: 5 }) },
      skillsRepository: {
        findOneBy: vi.fn().mockResolvedValue(null),
        create: vi.fn((x) => x),
        save: vi.fn().mockResolvedValue(saved),
      },
      membershipsRepository: {},
    });
    const result = await service.addSkill(adminUser, 5, { skill: VolunteerSkillType.ANIMATION });
    expect(result).toEqual(saved);
  });

  it('refuse si la compétence existe déjà', async () => {
    const service = makeService({
      volunteersRepository: { findOneBy: vi.fn().mockResolvedValue({ id: 5 }) },
      skillsRepository: {
        findOneBy: vi.fn().mockResolvedValue({ id: 99 }),
      },
      membershipsRepository: {},
    });
    await expect(
      service.addSkill(adminUser, 5, { skill: VolunteerSkillType.ANIMATION }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("lance NotFoundException si le bénévole n'existe pas", async () => {
    const service = makeService({
      volunteersRepository: { findOneBy: vi.fn().mockResolvedValue(null) },
      skillsRepository: {},
      membershipsRepository: {},
    });
    await expect(
      service.addSkill(adminUser, 999, { skill: VolunteerSkillType.SECURITY }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('VolunteerSkillsService — removeSkill', () => {
  it('supprime une compétence existante', async () => {
    const skill = { id: 7, volunteerId: 5, skill: VolunteerSkillType.HEALTH };
    const remove = vi.fn().mockResolvedValue(undefined);
    const service = makeService({
      volunteersRepository: { findOneBy: vi.fn().mockResolvedValue({ id: 5 }) },
      skillsRepository: {
        findOneBy: vi.fn().mockResolvedValue(skill),
        remove,
      },
      membershipsRepository: {},
    });
    await service.removeSkill(adminUser, 5, 7);
    expect(remove).toHaveBeenCalledWith(skill);
  });

  it('lance NotFoundException si la compétence est introuvable', async () => {
    const service = makeService({
      volunteersRepository: { findOneBy: vi.fn().mockResolvedValue({ id: 5 }) },
      skillsRepository: {
        findOneBy: vi.fn().mockResolvedValue(null),
      },
      membershipsRepository: {},
    });
    await expect(service.removeSkill(adminUser, 5, 999)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('VolunteerSkillsService — addTag', () => {
  it('normalise la valeur du tag (trim + lowercase)', async () => {
    const create = vi.fn((x) => x);
    const save = vi.fn((x) => Promise.resolve({ id: 1, ...x }));
    const service = makeService({
      volunteersRepository: { findOneBy: vi.fn().mockResolvedValue({ id: 5 }) },
      tagsRepository: { create, save },
      membershipsRepository: {},
    });
    await service.addTag(adminUser, 5, { value: '  Musique  ' });
    expect(create).toHaveBeenCalledWith({ volunteerId: 5, value: 'musique' });
  });

  it('refuse un tag vide', async () => {
    const service = makeService({
      volunteersRepository: { findOneBy: vi.fn().mockResolvedValue({ id: 5 }) },
      tagsRepository: {},
      membershipsRepository: {},
    });
    await expect(service.addTag(adminUser, 5, { value: '   ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('VolunteerSkillsService — removeTag', () => {
  it('supprime un tag existant', async () => {
    const tag = { id: 3, volunteerId: 5, value: 'musique' };
    const remove = vi.fn().mockResolvedValue(undefined);
    const service = makeService({
      volunteersRepository: { findOneBy: vi.fn().mockResolvedValue({ id: 5 }) },
      tagsRepository: { findOneBy: vi.fn().mockResolvedValue(tag), remove },
      membershipsRepository: {},
    });
    await service.removeTag(adminUser, 5, 3);
    expect(remove).toHaveBeenCalledWith(tag);
  });

  it('lance NotFoundException si le tag est introuvable', async () => {
    const service = makeService({
      volunteersRepository: { findOneBy: vi.fn().mockResolvedValue({ id: 5 }) },
      tagsRepository: { findOneBy: vi.fn().mockResolvedValue(null) },
      membershipsRepository: {},
    });
    await expect(service.removeTag(adminUser, 5, 999)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('VolunteerSkillsService — assertCanWrite', () => {
  it('autorise ADMIN', async () => {
    const service = makeService({});
    await expect(service.assertCanWrite(adminUser, 5)).resolves.toBeUndefined();
  });

  it('autorise COORDINATOR', async () => {
    const service = makeService({});
    await expect(service.assertCanWrite(coordinatorUser, 5)).resolves.toBeUndefined();
  });

  it('refuse VIEWER', async () => {
    const service = makeService({});
    await expect(service.assertCanWrite(viewerUser, 5)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('autorise VOLUNTEERS pour son propre profil', async () => {
    const service = makeService({
      volunteersRepository: {
        findOne: vi.fn().mockResolvedValue({ id: 5, user: { id: volunteerUser.id } }),
      },
      membershipsRepository: {},
    });
    await expect(service.assertCanWrite(volunteerUser, 5)).resolves.toBeUndefined();
  });

  it("refuse VOLUNTEERS pour le profil d'un autre", async () => {
    const service = makeService({
      volunteersRepository: {
        findOne: vi.fn().mockResolvedValue({ id: 5, user: { id: 999 } }),
      },
      membershipsRepository: {},
    });
    await expect(service.assertCanWrite(volunteerUser, 5)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('autorise HEALTH si le bénévole est dans une équipe HEALTH', async () => {
    const qb = {
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getCount: vi.fn().mockResolvedValue(1),
    };
    const service = makeService({
      membershipsRepository: {
        findOne: vi.fn().mockResolvedValue(null),
        createQueryBuilder: vi.fn().mockReturnValue(qb),
      },
    });
    await expect(service.assertCanWrite(healthUser, 5)).resolves.toBeUndefined();
  });

  it("refuse HEALTH si le bénévole n'est pas dans une équipe santé", async () => {
    const qb = {
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getCount: vi.fn().mockResolvedValue(0),
    };
    const service = makeService({
      membershipsRepository: {
        findOne: vi.fn().mockResolvedValue(null),
        createQueryBuilder: vi.fn().mockReturnValue(qb),
      },
    });
    await expect(service.assertCanWrite(healthUser, 5)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('autorise LOGISTICS si le bénévole est dans une équipe logistique', async () => {
    const qb = {
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getCount: vi.fn().mockResolvedValue(2),
    };
    const service = makeService({
      membershipsRepository: {
        createQueryBuilder: vi.fn().mockReturnValue(qb),
      },
    });
    await expect(service.assertCanWrite(logisticsUser, 5)).resolves.toBeUndefined();
  });

  it("refuse LOGISTICS si le bénévole n'est pas dans le périmètre logistique", async () => {
    const qb = {
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getCount: vi.fn().mockResolvedValue(0),
    };
    const service = makeService({
      membershipsRepository: {
        createQueryBuilder: vi.fn().mockReturnValue(qb),
      },
    });
    await expect(service.assertCanWrite(logisticsUser, 5)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
