import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { VolunteersService } from './volunteers.service';

const build = (volunteer: unknown) => {
  const repository = {
    findOne: vi.fn().mockResolvedValue(volunteer),
    save: vi.fn((payload) => Promise.resolve(payload)),
  };
  const service = new VolunteersService(repository as never, {} as never);
  return { service, repository };
};

describe('VolunteersService.updateOwnProfile', () => {
  it('met à jour téléphone et email du bénévole connecté', async () => {
    const volunteer = { id: 7, phone: null, email: null };
    const { service, repository } = build(volunteer);

    const updated = await service.updateOwnProfile(42, {
      phone: '+33612345678',
      email: 'camille.perrot@example.fr',
    });

    expect(updated.phone).toBe('+33612345678');
    expect(updated.email).toBe('camille.perrot@example.fr');
    expect(repository.save).toHaveBeenCalledWith(volunteer);
  });

  it('permet d effacer un champ avec une valeur vide ou null', async () => {
    const volunteer = { id: 7, phone: '+33612345678', email: 'a@b.fr' };
    const { service } = build(volunteer);

    const updated = await service.updateOwnProfile(42, { phone: '', email: null });

    expect(updated.phone).toBeNull();
    expect(updated.email).toBeNull();
  });

  it('rejette un téléphone ou un email invalide', async () => {
    const { service } = build({ id: 7 });

    await expect(service.updateOwnProfile(42, { phone: 'abc' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.updateOwnProfile(42, { email: 'pas-un-email' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('renvoie 404 quand aucun profil bénévole n est rattaché', async () => {
    const { service } = build(null);

    await expect(service.updateOwnProfile(42, { phone: '+33612345678' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('ignore les champs hors liste blanche', async () => {
    const volunteer = { id: 7, firstName: 'Camille', notes: 'note coordination' };
    const { service } = build(volunteer);

    const updated = await service.updateOwnProfile(42, {
      firstName: 'Autre',
      notes: 'modifié',
    } as never);

    expect(updated.firstName).toBe('Camille');
    expect(updated.notes).toBe('note coordination');
  });
});
