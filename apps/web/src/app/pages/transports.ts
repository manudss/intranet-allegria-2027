import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SHARED_IMPORTS } from '../shared/shared-imports';

/**
 * Entrée « Transports » : la gestion des transports se fait par délégation
 * (fiche de la délégation, vues Sous-délégations et Exceptions). Cette page
 * n'affiche plus ni cartes ni liste de délégations (lot 1 de la refonte) ;
 * la rubrique reste distincte de « Délégations ».
 */
@Component({
  selector: 'app-transports',
  standalone: true,
  imports: [...SHARED_IMPORTS, RouterLink],
  templateUrl: './transports.html',
  styleUrl: '../shared/crud.scss',
})
export class Transports {}
