import { describe, expect, it, vi } from 'vitest';
import { AssignmentsService } from './assignments.service';
import { HostFamilyAssignmentsController } from './host-family-assignments.controller';

describe('HostFamilyAssignmentsController', () => {
  it('retourne les affectations filtrées par famille', async () => {
    const assignments = [{ id: 7, type: 'JEUNE', groupId: 2, status: 'CONFIRMED' }];
    const service = { findByHostFamily: vi.fn().mockResolvedValue(assignments) } as unknown as AssignmentsService;
    const controller = new HostFamilyAssignmentsController(service);

    await expect(controller.findByHostFamily(42)).resolves.toEqual(assignments);
    expect(service.findByHostFamily).toHaveBeenCalledWith(42);
  });
});
