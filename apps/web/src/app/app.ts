import { Component } from '@angular/core';
import { TuiRoot } from '@taiga-ui/core';
import { Layout } from './layout';

@Component({
  imports: [TuiRoot, Layout],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
