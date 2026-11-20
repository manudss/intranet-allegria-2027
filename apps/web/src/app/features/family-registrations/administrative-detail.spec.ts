import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { FamilyAdministrativeDetail } from './administrative-detail';
import { EMPTY_CONTACT, newYouth } from '@mej-allegria/shared';
describe('Complete administrative view', () => {
  it('renders every family field and explicit withdrawn attestation state without medical data', async () => {
    await TestBed.configureTestingModule({
      imports: [FamilyAdministrativeDetail],
    }).compileComponents();
    const f = TestBed.createComponent(FamilyAdministrativeDetail);
    const y = newYouth('fiction');
    y.identity = {
      firstName: 'Camille',
      lastName: 'FICTIF',
      dateOfBirth: '2012-05-01',
      sex: 'FEMALE',
      mejAgeGroup: 'TA',
      dioceseId: 'OTHER',
      otherDiocese: 'Pays fictif',
      city: 'Ville jeune fictive',
      mejGroup: 'Groupe fictif',
      legalCapacity: 'LEGAL',
    };
    y.logistics = {
      presence: 'FULL',
      arrival: 'Arrivée fictive',
      departure: 'Départ fictif',
      transport: 'Transport fictif',
      accommodation: 'Hébergement fictif',
      notes: 'Notes fictives',
    };
    y.signatures = [
      {
        templateId: 'Autorisation fictive',
        version: 'v1',
        digest: 'f'.repeat(64),
        signerName: 'Signataire fictif',
        capacity: 'LEGAL',
        signedAt: '2026-11-20T12:00:00Z',
        withdrawnAt: '2026-11-20T13:00:00Z',
      },
    ];
    const contact = {
      ...EMPTY_CONTACT,
      name: 'Parent fictif',
      phone: '0600000000',
      address: 'Adresse fictive',
      postalCode: '69000',
      city: 'Ville foyer fictive',
      emergencyName: 'Urgence fictive',
      emergencyPhone: '0600000001',
    };
    f.componentRef.setInput('youth', y);
    f.componentRef.setInput('contact', contact);
    f.componentRef.setInput('email', 'fiction@example.test');
    f.detectChanges();
    await f.whenStable();
    const text = f.nativeElement.textContent;
    for (const value of [
      ...Object.values(contact),
      ...Object.values(y.logistics).filter((v) => v !== 'FULL'),
      'Camille',
      'FICTIF',
      '2012-05-01',
      'Féminin',
      'TA',
      'Pays fictif',
      'Ville jeune fictive',
      'Groupe fictif',
      'Représentant légal',
      'Séjour complet',
      'fiction@example.test',
      'Signataire fictif',
      'Retirée / à renouveler',
      'v1',
    ])
      expect(text).toContain(value);
    expect(text).not.toContain('foodAllergy');
  });
});
