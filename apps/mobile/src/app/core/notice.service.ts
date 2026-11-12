import { Injectable, signal } from '@angular/core';

export interface AppNotice {
  label: string;
  text: string;
  kind: 'error' | 'info';
}

/** Notification éphémère affichée en bandeau dans le shell applicatif. */
@Injectable({ providedIn: 'root' })
export class NoticeService {
  private readonly noticeState = signal<AppNotice | null>(null);
  readonly notice = this.noticeState.asReadonly();
  private timer: ReturnType<typeof setTimeout> | null = null;

  show(notice: AppNotice): void {
    this.noticeState.set(notice);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.dismiss(), 8000);
  }

  dismiss(): void {
    this.noticeState.set(null);
  }
}
