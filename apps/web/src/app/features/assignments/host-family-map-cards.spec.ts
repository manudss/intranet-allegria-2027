import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { HostFamilyMapCardsComponent } from './host-family-map-cards';

describe('HostFamilyMapCardsComponent', () => {
  it('affiche les bons labels de capacite', async () => {
    await TestBed.configureTestingModule({
      imports: [HostFamilyMapCardsComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(HostFamilyMapCardsComponent);
    const component = fixture.componentInstance;
    expect(component.capacityLabel('AVAILABLE')).toBe('Disponible');
    expect(component.capacityLabel('FULL')).toBe('Pleine');
    expect(component.capacityLabel('UNDER_USED')).toBe('Sous-utilisee');
  });

  it('emet le changement de groupe choisi sur une carte (0 = aucun groupe)', async () => {
    await TestBed.configureTestingModule({ imports: [HostFamilyMapCardsComponent] }).compileComponents();
    const component = TestBed.createComponent(HostFamilyMapCardsComponent).componentInstance;
    const events: { familyId: number; groupId: number | null }[] = [];
    component.groupChange.subscribe((e) => events.push(e));
    component.onGroupPick(7, 3);
    component.onGroupPick(7, 0);
    expect(events).toEqual([
      { familyId: 7, groupId: 3 },
      { familyId: 7, groupId: null },
    ]);
  });
});
