import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { PersonPickerComponent, PersonSummary } from '../shared/person-picker.component';

type Opt = { code: string; label: string };
type Catalog = {
  modules: Opt[];
  levels: Opt[];
  scopes: Opt[];
  roles: Opt[];
  teamTypes: (Opt & { isActive: boolean })[];
};
type Rule = {
  subjectKind: string;
  subjectKey: string;
  module: string;
  level: string;
  scope: string;
};
type Grant = {
  module: string;
  level: string;
  scope: string;
  pairs: { level: string; scope: string }[];
  sources: string[];
};
type Described = {
  user: { id: number; email: string };
  roles: string[];
  teamTypes: string[];
  groupIds: number[];
  grants: Grant[];
};
type Override = {
  id: number;
  userId: number;
  email: string;
  module: string;
  level: string;
  scope: string;
  reason: string;
  expiresAt: string | null;
};
type LogRow = {
  id: number;
  actorEmail: string;
  action: string;
  detail: unknown;
  createdAt: string;
};
type Cell = { level: string; scope: string };
type GroupRow = { id: number; name: string };

const ACTION_LABELS: Record<string, string> = {
  RULES_SAVED: 'Matrice modifiée',
  USER_GROUPS_SET: 'Groupes d’une personne modifiés',
  OVERRIDE_CREATED: 'Exception créée',
  OVERRIDE_DELETED: 'Exception supprimée',
};

@Component({
  selector: 'app-parametres-roles',
  standalone: true,
  imports: [DatePipe, PersonPickerComponent],
  templateUrl: './parametres-roles.html',
  styleUrl: './parametres-roles.scss',
})
export class ParametresRoles implements OnInit {
  private readonly http = inject(HttpClient);

  protected readonly showGlobal = signal(false);
  protected readonly tab = signal<'matrix' | 'user' | 'logs'>('matrix');
  protected readonly catalog = signal<Catalog | null>(null);
  protected readonly rules = signal<Rule[]>([]);
  protected readonly message = signal<{ kind: 'ok' | 'error'; text: string } | null>(null);
  protected readonly busy = signal(false);

  // Matrice
  protected readonly subject = signal<string>('ROLE:ADMIN');
  protected readonly draft = signal<Record<string, Cell>>({});
  protected readonly dirty = signal(false);

  // Voir comme
  protected readonly picked = signal<PersonSummary | null>(null);
  protected readonly groups = signal<GroupRow[]>([]);
  protected readonly userId = signal<number | null>(null);
  protected readonly described = signal<Described | null>(null);
  protected readonly groupDraft = signal<number[]>([]);
  protected readonly overrides = signal<Override[]>([]);
  protected readonly ovForm = signal({
    module: 'PARTICIPANTS',
    level: 'VIEW',
    scope: 'ALL',
    reason: '',
    expiresAt: '',
  });

  // Journal
  protected readonly logs = signal<LogRow[]>([]);

  protected readonly subjectOptions = computed(() => {
    const c = this.catalog();
    if (!c) return { roles: [], types: [] };
    return { roles: c.roles, types: c.teamTypes };
  });
  protected readonly subjectLabel = computed(() => {
    const [kind, key] = this.subject().split(':');
    const c = this.catalog();
    const list = kind === 'ROLE' ? c?.roles : c?.teamTypes;
    return list?.find((x) => x.code === key)?.label ?? key;
  });
  protected readonly userOverrides = computed(() =>
    this.overrides().filter((o) => o.userId === this.userId()),
  );

  ngOnInit(): void {
    this.http.get<Catalog>('/api/access/catalog').subscribe({
      next: (c) => {
        this.catalog.set(c);
        this.loadRules();
      },
      error: () => this.fail('Chargement du catalogue impossible (droits administrateur requis).'),
    });
    this.http.get<Record<string, boolean>>('/api/access/options').subscribe({
      next: (o) => {
        this.showGlobal.set(o['GROUP_SCOPE_SHOW_OTHER_TEAMS'] === true);
      },
    });
    this.http.get<GroupRow[]>('/api/groups').subscribe({ next: (g) => this.groups.set(g) });
  }

  protected setTab(tab: 'matrix' | 'user' | 'logs') {
    this.tab.set(tab);
    this.message.set(null);
    if (tab === 'logs') this.loadLogs();
    if (tab === 'user') this.loadOverrides();
  }

  protected moduleLabel(code: string): string {
    return this.catalog()?.modules.find((m) => m.code === code)?.label ?? code;
  }
  protected levelLabel(code: string): string {
    return this.catalog()?.levels.find((l) => l.code === code)?.label ?? code;
  }
  protected scopeLabel(code: string): string {
    return this.catalog()?.scopes.find((s) => s.code === code)?.label ?? code;
  }
  protected actionLabel(a: string): string {
    return ACTION_LABELS[a] ?? a;
  }
  protected detailText(d: unknown): string {
    return typeof d === 'string' ? d : JSON.stringify(d);
  }
  protected groupName(id: number): string {
    return this.groups().find((g) => g.id === id)?.name ?? `#${id}`;
  }

  // ---- Matrice ----
  private loadRules() {
    this.http.get<Rule[]>('/api/access/rules').subscribe({
      next: (r) => {
        this.rules.set(r);
        this.buildDraft();
      },
      error: () => this.fail('Chargement des règles impossible.'),
    });
  }

  private buildDraft() {
    const [kind, key] = this.subject().split(':');
    const draft: Record<string, Cell> = {};
    for (const m of this.catalog()?.modules ?? []) {
      const r = this.rules().find(
        (x) => x.subjectKind === kind && x.subjectKey === key && x.module === m.code,
      );
      draft[m.code] = { level: r?.level ?? '', scope: r?.scope ?? 'ALL' };
    }
    this.draft.set(draft);
    this.dirty.set(false);
  }

  protected pickSubject(value: string) {
    this.subject.set(value);
    this.buildDraft();
    this.message.set(null);
  }

  protected setCell(module: string, field: 'level' | 'scope', value: string) {
    this.draft.update((d) => ({ ...d, [module]: { ...d[module], [field]: value } }));
    this.dirty.set(true);
  }

  protected cell(module: string): Cell {
    return this.draft()[module] ?? { level: '', scope: 'ALL' };
  }

  protected saveMatrix() {
    const [kind, key] = this.subject().split(':');
    const payload = Object.entries(this.draft()).map(([module, c]) => ({
      subjectKind: kind,
      subjectKey: key,
      module,
      level: c.level || null,
      scope: c.scope || 'ALL',
    }));
    this.busy.set(true);
    this.http.put('/api/access/rules', { rules: payload }).subscribe({
      next: () => {
        this.busy.set(false);
        this.ok(`Droits de « ${this.subjectLabel()} » enregistrés.`);
        this.loadRules();
      },
      error: (e) => this.fail(e?.error?.message ?? 'Enregistrement refusé.'),
    });
  }

  protected toggleOption(key: 'GROUP_SCOPE_SHOW_OTHER_TEAMS', enabled: boolean) {
    this.http.put<Record<string, boolean>>('/api/access/options', { key, enabled }).subscribe({
      next: (o) => {
        this.showGlobal.set(o['GROUP_SCOPE_SHOW_OTHER_TEAMS'] === true);
        this.ok('Option enregistrée.');
      },
      error: (e) => this.fail(e?.error?.message ?? 'Enregistrement refusé.'),
    });
  }

  protected resetMatrix() {
    this.buildDraft();
  }

  // ---- Voir comme ----
  protected onPick(person: PersonSummary | null) {
    this.picked.set(person);
    this.pickUser(person ? String(person.id) : '');
  }

  protected pickUser(value: string) {
    const id = value ? Number(value) : null;
    this.userId.set(id);
    this.described.set(null);
    if (!id) return;
    this.http.get<Described>(`/api/access/users/${id}/effective`).subscribe({
      next: (d) => {
        this.described.set(d);
        this.groupDraft.set([...d.groupIds]);
      },
      error: () => this.fail('Lecture des droits impossible.'),
    });
  }

  protected toggleGroup(id: number, checked: boolean) {
    this.groupDraft.update((g) => (checked ? [...new Set([...g, id])] : g.filter((x) => x !== id)));
  }

  protected saveGroups() {
    const id = this.userId();
    if (!id) return;
    this.busy.set(true);
    this.http.put(`/api/access/users/${id}/groups`, { groupIds: this.groupDraft() }).subscribe({
      next: () => {
        this.busy.set(false);
        this.ok('Groupes enregistrés.');
        this.pickUser(String(id));
      },
      error: (e) => this.fail(e?.error?.message ?? 'Enregistrement refusé.'),
    });
  }

  private loadOverrides() {
    this.http.get<Override[]>('/api/access/overrides').subscribe({
      next: (o) => this.overrides.set(o),
      error: () => this.fail('Chargement des exceptions impossible.'),
    });
  }

  protected setOv(field: string, value: string) {
    this.ovForm.update((f) => ({ ...f, [field]: value }));
  }

  protected addOverride() {
    const id = this.userId();
    const f = this.ovForm();
    if (!id) return;
    if (f.reason.trim().length < 3) {
      this.fail('Le motif de l’exception est obligatoire.');
      return;
    }
    this.busy.set(true);
    this.http
      .post('/api/access/overrides', {
        userId: id,
        module: f.module,
        level: f.level,
        scope: f.scope,
        reason: f.reason.trim(),
        expiresAt: f.expiresAt ? new Date(f.expiresAt).toISOString() : null,
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.ok('Exception ajoutée.');
          this.ovForm.update((x) => ({ ...x, reason: '', expiresAt: '' }));
          this.loadOverrides();
          this.pickUser(String(id));
        },
        error: (e) => this.fail(e?.error?.message ?? 'Exception refusée.'),
      });
  }

  protected removeOverride(o: Override) {
    this.http.delete(`/api/access/overrides/${o.id}`).subscribe({
      next: () => {
        this.ok('Exception supprimée.');
        this.loadOverrides();
        if (this.userId()) this.pickUser(String(this.userId()));
      },
      error: () => this.fail('Suppression impossible.'),
    });
  }

  // ---- Journal ----
  private loadLogs() {
    this.http.get<LogRow[]>('/api/access/logs').subscribe({
      next: (l) => this.logs.set(l),
      error: () => this.fail('Chargement du journal impossible.'),
    });
  }

  private ok(text: string) {
    this.busy.set(false);
    this.message.set({ kind: 'ok', text });
  }
  private fail(text: string) {
    this.busy.set(false);
    this.message.set({ kind: 'error', text });
  }
}
