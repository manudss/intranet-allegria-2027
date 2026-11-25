import { AppearanceService } from '@mej-allegria/appearance';
import { Component, inject } from '@angular/core';
import { Shell } from './layout/shell/shell';

@Component({
  imports: [Shell],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly appearance = inject(AppearanceService);
  protected title = 'site';
}
