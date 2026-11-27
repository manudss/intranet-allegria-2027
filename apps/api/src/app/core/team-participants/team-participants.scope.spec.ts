import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { TeamParticipantsService } from './team-participants.service';

// Données fictives : équipe 1 = membres délégation 5 ; équipe 2 = membres délégation 6 ;
// équipe 4 = vide ; participants 1 (délégation 5) et 2 (délégation 6).
const member = (id: number, groupId: number) => ({
  participant: { id, group: { id: groupId } },
});
const teamsFixture: Record<number, any> = {
  1: { id: 1, name: 'T1', maxSize: 10, members: [member(1, 5)] },
  2: { id: 2, name: 'T2', maxSize: 10, members: [member(2, 6)] },
  4: { id: 4, name: 'T4', maxSize: 10, members: [] },
};
const participantsFixture: Record<number, any> = {
  1: { id: 1, group: { id: 5 } },
  2: { id: 2, group: { id: 6 } },
  3: { id: 3, group: { id: 5 } },
};

const scope5 = { all: false, groupIds: [5] };

function build() {
  const saved: any[] = [];
  const removed: any[] = [];
  const service = new TeamParticipantsService(
    { findOne: async ({ where: { id } }: any) => teamsFixture[id] ?? null } as never,
    { findOne: async ({ where: { id } }: any) => participantsFixture[id] ?? null } as never,
    {
      findOne: async ({ where }: any) => {
        const team = teamsFixture[where.team.id];
        const m = team?.members.find((x: any) => x.participant.id === where.participant.id);
        return m ? { team, participant: m.participant } : null;
      },
      count: async () => 1,
      create: (payload: any) => payload,
      save: async (payload: any) => {
        saved.push(payload);
        return payload;
      },
      remove: async (payload: any) => {
        removed.push(payload);
      },
    } as never,
  );
  return { service, saved, removed };
}

describe('composition d’équipe : périmètre dérivé du rattachement des personnes', () => {
  it('ajout dans une équipe de sa délégation : autorisé', async () => {
    const { service, saved } = build();
    await service.addParticipant(1, { participantId: 3 } as never, scope5);
    expect(saved).toHaveLength(1);
  });

  it('ajout dans une équipe vide : autorisé, elle rejoint la portée au premier membre', async () => {
    const { service, saved } = build();
    await service.addParticipant(4, { participantId: 3 } as never, scope5);
    expect(saved).toHaveLength(1);
  });

  it('négatif : ajout dans une équipe entièrement d’une autre délégation → introuvable', async () => {
    const { service, saved } = build();
    await expect(
      service.addParticipant(2, { participantId: 3 } as never, scope5),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(saved).toHaveLength(0);
  });

  it('négatif : ajout d’un participant d’une autre délégation → introuvable', async () => {
    const { service, saved } = build();
    await expect(
      service.addParticipant(1, { participantId: 2 } as never, scope5),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(saved).toHaveLength(0);
  });

  it('retrait de son membre dans une équipe mixte : autorisé', async () => {
    teamsFixture[1].members.push(member(2, 6));
    const { service, removed } = build();
    await service.removeParticipant(1, 1, scope5);
    expect(removed).toHaveLength(1);
    teamsFixture[1].members.pop();
  });

  it('négatif : retrait du membre d’une autre délégation, même dans une équipe mixte → introuvable', async () => {
    teamsFixture[1].members.push(member(2, 6));
    const { service, removed } = build();
    await expect(service.removeParticipant(1, 2, scope5)).rejects.toBeInstanceOf(NotFoundException);
    expect(removed).toHaveLength(0);
    teamsFixture[1].members.pop();
  });

  it('négatif : retrait dans une équipe entièrement d’une autre délégation → introuvable', async () => {
    const { service } = build();
    await expect(service.removeParticipant(2, 2, scope5)).rejects.toBeInstanceOf(NotFoundException);
  });
});
