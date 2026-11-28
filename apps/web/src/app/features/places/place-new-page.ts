import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { PageLayoutComponent } from '../../shared/ui-components';
import { PlaceFormComponent } from './place-form.component';

@Component({
  selector: 'app-place-new-page',
  standalone: true,
  imports: [PageLayoutComponent, PlaceFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-page-layout title="Nouveau lieu" description="Seul le lieu porte l'adresse et le point GPS. Les salles s'ajoutent ensuite depuis sa fiche.">
    <app-place-form (saved)="router.navigate(['/lieux', $event.id])" (cancelled)="router.navigate(['/lieux'])" />
  </app-page-layout>`,
})
export class PlaceNewPageComponent {
  protected readonly router = inject(Router);
}
