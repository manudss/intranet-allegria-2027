import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TuiButton } from '@taiga-ui/core';
@Component({
  standalone: true,
  imports: [RouterLink, TuiButton],
  templateUrl: './status-pages.html',
  styleUrls: ['./status-pages.scss'],
})
export class UnauthorizedPage {}
