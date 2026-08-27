import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { VolunteerShift, VolunteerShiftStatus } from '../models/models';
import { VolunteerMissionsApiService } from '../services/api.services';

@Component({
  selector: 'app-jour-j',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './jour-j.html',
  styleUrl: './jour-j.scss',
})
export class JourJ implements OnInit {
  readonly shiftStatuses = Object.values(VolunteerShiftStatus);

  private readonly missionsApi = inject(VolunteerMissionsApiService);
  private readonly auth = inject(AuthService);

  readonly selectedDate = signal(new Date().toISOString().slice(0, 10));
  readonly loading = signal(false);
  readonly shifts = signal<VolunteerShift[]>([]);
  readonly canWrite = computed(() =>
    this.auth.hasAnyRole(['ADMIN', 'COORDINATOR', 'VOLUNTEERS', 'HEALTH', 'ANIMATOR', 'LOGISTICS']),
  );

  ngOnInit(): void {
    this.refresh();
  }

  setDate(date: string): void {
    this.selectedDate.set(date);
    this.refresh();
  }

  changeShiftStatus(shift: VolunteerShift, status: string): void {
    this.missionsApi
      .changeShiftStatus(shift.missionId, shift.id, status as VolunteerShiftStatus)
      .subscribe(() => this.refresh());
  }

  statusLabel(status: VolunteerShiftStatus): string {
    return {
      [VolunteerShiftStatus.TODO]: 'A faire',
      [VolunteerShiftStatus.ASSIGNED]: 'Assigne',
      [VolunteerShiftStatus.IN_PROGRESS]: 'En cours',
      [VolunteerShiftStatus.DONE]: 'Termine',
      [VolunteerShiftStatus.CANCELLED]: 'Annule',
      [VolunteerShiftStatus.NOT_DONE]: 'Non realise',
    }[status];
  }

  statusClass(status: VolunteerShiftStatus): string {
    if (status === VolunteerShiftStatus.DONE) return 'done';
    if (status === VolunteerShiftStatus.IN_PROGRESS) return 'progress';
    if (status === VolunteerShiftStatus.CANCELLED || status === VolunteerShiftStatus.NOT_DONE) return 'cancel';
    if (status === VolunteerShiftStatus.ASSIGNED) return 'assigned';
    return 'todo';
  }

  private refresh(): void {
    this.loading.set(true);
    this.missionsApi
      .getDayView(this.selectedDate())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((shifts) => this.shifts.set(shifts));
  }
}
