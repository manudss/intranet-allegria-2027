import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiLabel, TuiInput } from '@taiga-ui/core';
import { HostingPlacementApiService } from '../features/hosting-placement/hosting-placement.api';
import { HostingGroupKind, HostingGroupSummary } from '../features/hosting-placement/hosting-placement.models';
import { SelectFieldComponent, SelectOption } from './select-field.component';

const KIND_OPTIONS: readonly SelectOption<HostingGroupKind>[] = [
  { value: 'ZONE', label: 'Zone géographique' },
  { value: 'PARISH', label: 'Paroisse' },
  { value: 'OTHER', label: 'Autre' },
];

/** Barre d'affectation en masse des hébergements cochés à un groupe (composants Taiga UI). */
@Component({
  selector: 'app-group-bulk-bar',
  imports: [FormsModule, TuiButton, TuiLabel, ...TuiInput, SelectFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './group-bulk-bar.component.html',
  styleUrl: './group-bulk-bar.component.scss',
})
export class GroupBulkBarComponent {
  private readonly api = inject(HostingPlacementApiService);
  readonly groups = input.required<readonly HostingGroupSummary[]>();
  readonly checkedIds = input.required<ReadonlySet<number>>();
  /** Émis après une modification réussie : le parent recharge ses données. */
  readonly changed = output<void>();
  readonly cleared = output<void>();
  protected readonly kindOptions = KIND_OPTIONS;
  protected readonly groupOptions = computed<SelectOption<number>[]>(() =>
    this.groups().map((g) => ({ value: g.id, label: g.name })),
  );
  protected readonly targetGroupId = signal<number | null>(null);
  protected readonly newGroupName = signal('');
  protected readonly newGroupKind = signal<HostingGroupKind>('ZONE');
  protected readonly busy = signal(false);
  protected readonly feedback = signal<{ text: string; error: boolean } | null>(null);

  private confirmBulk(count: number, label: string): boolean {
    return count < 20 || confirm(`${label} : ${count} lieux concernés. Continuer ?`);
  }

  private done(text: string, error = false): void {
    this.busy.set(false);
    this.feedback.set({ text, error });
    if (!error) this.changed.emit();
  }

  private fail(err: { error?: { message?: string | string[] } }): void {
    const m = err?.error?.message;
    this.done(Array.isArray(m) ? m.join(', ') : (m ?? 'Action impossible.'), true);
  }

  protected assign(groupId: number | null): void {
    const ids = [...this.checkedIds()];
    const label = groupId === null ? 'Retirer du groupe' : 'Affecter au groupe';
    if (!ids.length || this.busy() || !this.confirmBulk(ids.length, label)) return;
    this.busy.set(true);
    this.api.setFamiliesGroup(ids, groupId).subscribe({
      next: (r) =>
        this.done(
          groupId === null
            ? `${r.updated} lieu(x) retiré(s) de leur groupe.`
            : `${r.updated} lieu(x) affecté(s) au groupe.`,
        ),
      error: (e) => this.fail(e),
    });
  }

  protected createAndAssign(): void {
    const name = this.newGroupName().trim();
    const ids = [...this.checkedIds()];
    if (!name || !ids.length || this.busy() || !this.confirmBulk(ids.length, 'Créer le groupe et y affecter')) return;
    this.busy.set(true);
    this.api.createGroup(name, { kind: this.newGroupKind() }).subscribe({
      next: (g) =>
        this.api.setFamiliesGroup(ids, g.id).subscribe({
          next: (r) => {
            this.newGroupName.set('');
            this.done(`Groupe « ${g.name} » créé avec ${r.updated} lieu(x).`);
          },
          error: (e) => {
            this.changed.emit();
            this.fail(e);
          },
        }),
      error: (e) => this.fail(e),
    });
  }
}
