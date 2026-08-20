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
});
