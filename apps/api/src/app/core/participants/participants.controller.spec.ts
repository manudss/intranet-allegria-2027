import { describe, expect, it, vi } from 'vitest';
import { ParticipantsController } from './participants.controller';
import { ParticipantsService } from './participants.service';

describe('ParticipantsController', () => {
  it('transmet tous les filtres de recherche au service', async () => {
    const result = { items: [], total: 0, limit: 10, offset: 0 };
    const service = { search: vi.fn().mockResolvedValue(result) } as unknown as ParticipantsService;
    const controller = new ParticipantsController(service);
    const query = { unassignedOnly: 'true', type: 'JEUNE' as const, teamId: '3', q: 'Martin', limit: '10' };

    await expect(controller.search(query)).resolves.toEqual(result);
    expect(service.search).toHaveBeenCalledWith(query);
  });
});
