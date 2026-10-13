import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AuthService } from '../../core/auth.service';
import { ProgrammePage } from './programme';

function setupWithRole(roles: string[]) {
  TestBed.configureTestingModule({
    imports: [ProgrammePage],
    providers: [
      {
        provide: AuthService,
        useValue: {
          hasAnyRole: (required: string[]) => required.some((r) => roles.includes(r)),
          currentUser: () => ({ id: 1, email: 'coordination@allegria2027.fr', roles }),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(ProgrammePage);
  fixture.detectChanges();
  return fixture.componentInstance;
}

describe('ProgrammePage', () => {
  it('affiche la chaîne J2 par défaut avec ses KPI', () => {
    const component = setupWithRole(['VIEWER']);

    expect(component.chain().length).toBeGreaterThan(0);
    expect(component.kpis().total).toBe(component.chain().length);
    expect(component.kpis().branches).toBeGreaterThan(0);
  });

  it('calcule un aperçu d’insertion sans l’appliquer tant que non confirmé, puis l’applique', () => {
    const component = setupWithRole(['COORDINATOR']);

    const firstId = component.chain()[0].id;
    component.openInsertForm(firstId);
    component.updateInsertDraft({ title: 'Pause', durationMinutes: 10 });
    component.previewInsertAction();

    expect(component.preview()).not.toBeNull();
    expect(component.allSequences().filter((s) => s.title === 'Pause')).toHaveLength(0);

    const lengthBefore = component.chain().length;
    component.confirmPreview();
    expect(component.chain().length).toBe(lengthBefore + 1);
    expect(component.allSequences().filter((s) => s.title === 'Pause')).toHaveLength(1);
  });

  it('permet de figer puis défiger une séquence pour un rôle coordination', () => {
    const component = setupWithRole(['COORDINATOR']);

    const mobileSequence = component.chain().find((s) => s.status === 'MOBILE')!;
    component.toggleFreeze(mobileSequence);
    expect(component.allSequences().find((s) => s.id === mobileSequence.id)?.status).toBe('FROZEN');

    const frozen = component.allSequences().find((s) => s.id === mobileSequence.id)!;
    component.toggleFreeze(frozen);
    expect(component.allSequences().find((s) => s.id === mobileSequence.id)?.status).toBe('MOBILE');
  });

  it("n'autorise pas le figement pour un rôle de lecture seule", () => {
    const component = setupWithRole(['VIEWER']);

    const mobileSequence = component.chain().find((s) => s.status === 'MOBILE')!;
    component.toggleFreeze(mobileSequence);
    expect(component.allSequences().find((s) => s.id === mobileSequence.id)?.status).toBe('MOBILE');
  });
});
