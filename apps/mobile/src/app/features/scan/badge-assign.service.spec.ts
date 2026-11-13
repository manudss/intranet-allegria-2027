import { AccessBadgeAssignment, activeAssignmentOf, deriveAssignMode } from './badge-assign.service';

const a = (over: Partial<AccessBadgeAssignment>): AccessBadgeAssignment => ({
  id: 1,
  participantId: 42,
  startsAt: '2027-07-01T08:00:00Z',
  endsAt: null,
  version: 1,
  ...over,
});

describe('deriveAssignMode', () => {
  it('sans historique → attribution simple', () => {
    expect(deriveAssignMode([])).toBe('assign');
  });

  it('badge actif (endsAt null) → remplacement', () => {
    expect(deriveAssignMode([a({ endsAt: null })])).toBe('replace');
  });

  it('historique clos uniquement → attribution simple', () => {
    expect(deriveAssignMode([a({ endsAt: '2027-07-02T10:00:00Z' })])).toBe('assign');
  });

  it('activeAssignmentOf retrouve le badge actif avec son code', () => {
    const active = a({ endsAt: null, badge: { id: 7, code: 'ab12cd34', lot: 'L2027-A', status: 'ASSIGNED' } });
    const closed = a({ id: 2, endsAt: '2027-07-02T10:00:00Z' });
    expect(activeAssignmentOf([closed, active])?.badge?.code).toBe('ab12cd34');
    expect(activeAssignmentOf([closed])).toBeNull();
  });
});
