import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService, MY_SPACE_ROLES } from '../../core/auth.service';
import { NoticeService } from '../../core/notice.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private readonly auth = inject(AuthService);
  private readonly notices = inject(NoticeService);

  readonly notice = this.notices.notice;
  readonly canAccessSpace = computed(() => this.auth.hasAnyRole(MY_SPACE_ROLES));

  dismissNotice(): void {
    this.notices.dismiss();
  }
}
