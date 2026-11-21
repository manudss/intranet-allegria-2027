import { AppearanceTaigaControl } from '@mej-allegria/appearance/taiga';
import { AppearanceService } from '@mej-allegria/appearance';
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TuiRoot } from '@taiga-ui/core';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, TuiRoot, AppearanceTaigaControl],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App { readonly appearance = inject(AppearanceService); }
