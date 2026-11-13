import {RouterLink} from '@angular/router';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, Subscription } from 'rxjs';
import { TuiButton } from '@taiga-ui/core';
import { AccessReportingApi, AccessSummary, ReportFilters, ReviewPage, ScanReviewItem } from './access-reporting-api.service';

export function reportFilters(from: string, to: string, zoneId: number | null, entryTypeId: number | null, exitTypeId: number | null): ReportFilters {
  const start = new Date(`${from}T00:00:00`), end = new Date(`${to}T00:00:00`);
  end.setDate(end.getDate() + 1); // inclusive local end date, half-open server range
  if (!from || !to || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || end.getTime() - start.getTime() > 31 * 86400000) throw new Error('Choisissez une période de 1 à 31 jours.');
  if (!!entryTypeId !== !!exitTypeId || (entryTypeId != null && entryTypeId === exitTypeId)) throw new Error('Choisissez deux types distincts pour les entrées et les sorties.');
  return { from: start.toISOString(), to: end.toISOString(), ...(zoneId != null ? {zoneId} : {}), ...(entryTypeId && exitTypeId ? {entryTypeId, exitTypeId} : {}) };
}
function localDate(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
@Component({
  selector: 'app-access-reporting', standalone: true, imports: [RouterLink, CommonModule, FormsModule, TuiButton, A11yModule],
  template: `
    <main class="page">
      <header><h1>Suivi des accès</h1><nav class="actions"><a routerLink="/acces/non-scannes">Non scannés · groupes attendus</a><a routerLink="/acces/groupes-exceptions">Exceptions des groupes</a></nav><p>Comptages reçus du terrain et scans à vérifier.</p></header>
      <form class="filters" (ngSubmit)="refresh()">
        <label>Zone<select name="zone" [(ngModel)]="zoneId"><option [ngValue]="null">Toutes les zones</option>@for (z of zones(); track z.id) { <option [ngValue]="z.id">{{ z.name }}</option> }</select></label>
        <label>Du<input name="from" type="date" [(ngModel)]="from" required /></label>
        <label>Au (inclus)<input name="to" type="date" [(ngModel)]="to" required /></label>
        <button tuiButton appearance="secondary" type="submit" [disabled]="loading() || !configured()">{{ loading() ? 'Chargement…' : 'Actualiser' }}</button>
      </form>
      <details class="settings"><summary>Types de scan utilisés pour les compteurs</summary>
        <div class="settings-grid">
          <label>Entrée<select aria-label="Type entrée" [(ngModel)]="entryTypeId"><option [ngValue]="null">Non défini</option>@for (t of types(); track t.id) {<option [ngValue]="t.id">{{ t.label }}</option>}</select></label>
          <label>Sortie<select aria-label="Type sortie" [(ngModel)]="exitTypeId"><option [ngValue]="null">Non défini</option>@for (t of types(); track t.id) {<option [ngValue]="t.id">{{ t.label }}</option>}</select></label>
          <label>Repas<select aria-label="Type repas" [(ngModel)]="mealTypeId"><option [ngValue]="null">Non défini</option>@for (t of types(); track t.id) {<option [ngValue]="t.id">{{ t.label }}</option>}</select></label>
        </div><p>Types ENTREE / SORTIE / REPAS proposés s'ils existent. Actualisez après modification.</p>
      </details>
      @if (error(); as message) { <div role="alert" class="error">{{ message }} @if (!configured()) {<button tuiButton size="s" type="button" (click)="configure()">Réessayer</button>}</div> }
      @if (notice(); as message) { <p role="status">{{ message }}</p> }
      @if (loading()) { <p role="status">Chargement des comptages…</p> }
      @if (summary(); as s) {
        <section class="metrics" aria-label="Compteurs">
          <article><h2>Présence estimée</h2><strong>{{ s.presence?.estimatedPresent ?? '—' }}</strong><p>{{ s.presence ? 'Dernier mouvement accepté par personne' : 'Définissez les types entrée et sortie' }}</p><p>Au {{ s.to | date:'dd/MM HH:mm' }} (borne exclue)</p></article>
          <article><h2>Repas servis</h2><strong>{{ meals() ?? '—' }}</strong><p>{{ appliedMealTypeId === null ? 'Définissez le type de scan repas' : 'Sur la période et la zone sélectionnées' }}</p><p>Scans ambigus exclus</p></article>
          <article><h2>À vérifier</h2><strong class="warning">{{ s.pendingReviews }}</strong><p>Doublons et envois tardifs</p><p>Toutes dates · zone sélectionnée</p></article>
        </section>
        <aside class="freshness"><p>Dernières données reçues : {{ s.lastReceivedAt ? (s.lastReceivedAt | date:'dd/MM HH:mm:ss') : 'aucun scan reçu' }} · Actualisé à {{ s.fetchedAt | date:'HH:mm:ss' }}</p><p>Les téléphones hors ligne ne sont pas encore comptés. La présence est une estimation, pas un décompte d'évacuation.</p></aside>
        <section class="panel">
          <h2>Scans à vérifier</h2><p class="hint">Toutes dates · zone sélectionnée. Une clôture conserve le scan et son verdict d'origine.</p>
          <div class="review-list">
            <div class="review-row table-head" aria-hidden="true"><span>Heure</span><span>Personne</span><span>Point</span><span>Motif</span><span>Traitement</span></div>
            @for (r of reviews().items; track r.id) {
              <div class="review-row">
                <div><span class="mobile-label">Heure</span>{{ (r.occurredAtLocal ?? r.receivedAt) | date:'dd/MM HH:mm' }}<small>Reçu {{ r.receivedAt | date:'dd/MM HH:mm' }}</small></div>
                <div><span class="mobile-label">Personne</span>{{ personName(r) }}</div>
                <div><span class="mobile-label">Point</span>{{ r.pointName }}</div>
                <div><span class="mobile-label">Motif</span>{{ reason(r) }}</div>
                <button tuiButton appearance="secondary" size="s" type="button" (click)="examine(r)" [attr.aria-label]="'Examiner le scan ' + r.id">Examiner</button>
              </div>
            } @empty { <p>Aucun scan à vérifier dans cette zone.</p> }
          </div>
          <nav class="pager" aria-label="Pages de scans"><button type="button" tuiButton appearance="secondary" size="s" [disabled]="offset() === 0 || loading()" (click)="page(-1)">Précédent</button><span>{{ offset() + (reviews().items.length ? 1 : 0) }}–{{ offset() + reviews().items.length }} / {{ reviews().total }}</span><button type="button" tuiButton appearance="secondary" size="s" [disabled]="offset() + 50 >= reviews().total || loading()" (click)="page(1)">Suivant</button></nav>
        </section>
        <details class="panel"><summary>Comptages par zone, type et service</summary>
          <div class="count-list">@for (c of s.counts; track $index) {<article><h3>{{ c.zoneName }} · {{ c.scanTypeLabel }}</h3><p>Service : {{ c.serviceKey ?? 'non défini' }}</p><p>{{ c.accepted }} acceptés · {{ c.uncertain }} ambigus · {{ c.duplicates }} doublons · {{ c.rejected }} refusés</p></article>} @empty {<p>Aucun scan reçu sur cette période.</p>}</div>
        </details>
      }
      @if (selected(); as r) {
        <div class="backdrop"><section class="dialog" cdkTrapFocus [cdkTrapFocusAutoCapture]="true" role="dialog" aria-modal="true" aria-labelledby="review-title" (keydown.escape)="cancelReview()">
          <h2 id="review-title">Examiner le scan #{{ r.id }}</h2><p>{{ personName(r) }} · {{ r.pointName }}</p><p>{{ reason(r) }}</p><p>Le verdict d'origine ({{ r.verdict }}) sera conservé. La note, votre compte et l'heure de clôture sont enregistrés.</p>
          <label>Note de vérification<textarea id="review-note" rows="4" maxlength="1000" [(ngModel)]="note" [disabled]="saving()"></textarea></label>
          @if (reviewError(); as message) {<p role="alert" class="error">{{ message }}</p>}
          <div class="actions"><button tuiButton type="button" [disabled]="saving() || note.trim().length < 3" (click)="closeReview()">{{ saving() ? 'Enregistrement…' : 'Clore la vérification' }}</button><button tuiButton appearance="secondary" type="button" [disabled]="saving()" (click)="cancelReview()">Annuler</button></div>
        </section></div>
      }
    </main>
  `,
  styles: [`
    :host { display:block; color:#1c1c28; } .page { max-width:1100px; padding:24px; margin:auto; display:flex; flex-direction:column; gap:18px; }
    h1 { font-size:24px; margin:0 0 6px; } h2 { margin:0; font-size:17px; } p { margin:5px 0; } header p,.hint,small { color:#666d7b; font-size:13px; }
    .filters,.settings-grid { display:flex; flex-wrap:wrap; gap:12px; align-items:end; } label { display:flex; flex-direction:column; gap:5px; font-size:13px; font-weight:600; }
    select,input,textarea { font:inherit; border:1px solid #dce0e7; border-radius:8px; padding:10px; min-height:44px; background:white; color:inherit; box-sizing:border-box; max-width:100%; } button { min-height:44px; }
    select { min-width:180px; } .settings { font-size:13px; } summary { cursor:pointer; min-height:44px; display:flex; align-items:center; font-weight:600; } .settings-grid { margin:10px 0; }
    .metrics { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:16px; } article,.panel,.freshness { background:white; border-radius:14px; padding:18px; box-shadow:0 1px 3px #00000012; } .metrics h2 { font-size:16px; font-weight:500; } .metrics strong { font-size:36px; line-height:1.3; display:block; } .metrics p { font-size:12px; color:#666d7b; } .warning { color:#ce312d; }
    .freshness { font-size:14px; } .review-list { margin-top:16px; } .review-row { display:grid; grid-template-columns:1.2fr 1.25fr 1.3fr 2fr auto; gap:12px; align-items:center; padding:12px 0; border-bottom:1px solid #eef0f3; font-size:14px; overflow-wrap:anywhere; } .review-row div { min-width:0; } .table-head { font-size:12px; color:#666d7b; text-transform:uppercase; font-weight:600; } small { display:block; } .mobile-label { display:none; } .pager { display:flex; justify-content:end; flex-wrap:wrap; gap:12px; align-items:center; margin-top:16px; font-size:13px; }
    .count-list { display:grid; gap:12px; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); } .count-list article { box-shadow:none; border:1px solid #eef0f3; } h3 { font-size:15px; margin:0; } .error { color:#a51e25; background:#fff0f1; padding:12px; border-radius:8px; } .backdrop { position:fixed; inset:0; background:#0006; z-index:1000; display:flex; align-items:center; justify-content:center; padding:16px; } .dialog { background:white; border-radius:16px; padding:24px; max-width:560px; width:100%; max-height:85vh; overflow:auto; } .dialog p { margin:12px 0; } .actions { display:flex; flex-wrap:wrap; gap:12px; margin-top:16px; }
    @media(max-width:800px) { .metrics { grid-template-columns:1fr; } .page { padding:16px; } .table-head { display:none; } .review-row { grid-template-columns:1fr 1fr; } .mobile-label { display:block; color:#666d7b; font-size:12px; margin-bottom:4px; } .review-row button { grid-column:1/-1; justify-self:start; } .filters label { flex:1; min-width:130px; } select { min-width:0; width:100%; } .settings-grid label { width:100%; } }
  `],
})
export class AccessReportingPage implements OnInit, OnDestroy {
  private readonly api = inject(AccessReportingApi);
  private loadSub?: Subscription; private configSub?: Subscription; private saveSub?: Subscription;
  readonly zones = signal<{id:number;name:string}[]>([]); readonly types = signal<{id:number;code:string;label:string}[]>([]);
  readonly configured = signal(false); readonly loading = signal(false); readonly error = signal(''); readonly notice = signal('');
  readonly summary = signal<AccessSummary | null>(null); readonly reviews = signal<ReviewPage>({items:[],total:0}); readonly offset = signal(0);
  readonly selected = signal<ScanReviewItem | null>(null); readonly saving = signal(false); readonly reviewError = signal(''); readonly meals = signal<number | null>(null);
  from = localDate(); to = localDate(); zoneId: number | null = null; entryTypeId: number | null = null; exitTypeId: number | null = null; mealTypeId: number | null = null; appliedMealTypeId: number | null = null; note = '';
  ngOnInit() { this.configure(); }
  ngOnDestroy() { this.loadSub?.unsubscribe(); this.configSub?.unsubscribe(); this.saveSub?.unsubscribe(); }
  configure() {
    this.error.set(''); this.configSub?.unsubscribe();
    this.configSub = forkJoin({zones:this.api.zones(),types:this.api.types()}).subscribe({next:({zones,types})=>{
      this.zones.set(zones); this.types.set(types); this.entryTypeId=types.find(t=>t.code==='ENTREE')?.id ?? null; this.exitTypeId=types.find(t=>t.code==='SORTIE')?.id ?? null; this.mealTypeId=types.find(t=>t.code==='REPAS')?.id ?? null; this.configured.set(true); this.refresh();
    },error:()=>this.error.set('Configuration indisponible. Vérifiez votre connexion et vos droits.')});
  }
  refresh(reset = true) {
    let filters: ReportFilters;
    try { filters=reportFilters(this.from,this.to,this.zoneId,this.entryTypeId,this.exitTypeId); }
    catch(e) { this.error.set((e as Error).message); this.summary.set(null); return; }
    if(reset) this.offset.set(0);
    const mealTypeId=this.mealTypeId;
    this.loadSub?.unsubscribe(); this.loading.set(true); this.error.set(''); this.summary.set(null);
    this.loadSub=forkJoin({summary:this.api.summary(filters),reviews:this.api.reviews(filters.zoneId,this.offset())}).subscribe({next:({summary,reviews})=>{
      this.summary.set(summary);this.reviews.set(reviews);this.appliedMealTypeId=mealTypeId;
      this.meals.set(mealTypeId===null?null:summary.counts.filter(c=>c.scanTypeId===mealTypeId).reduce((sum,c)=>sum+c.accepted,0));this.loading.set(false);
    },error:()=>{this.loading.set(false);this.error.set('Chargement impossible. Vérifiez votre connexion et vos droits, puis actualisez.');}});
  }
  page(direction:number) { this.offset.set(Math.max(0,this.offset()+direction*50));this.refresh(false); }
  personName(r:ScanReviewItem) { return [r.firstName,r.lastName].filter(Boolean).join(' ') || (r.participantId ? `Personne #${r.participantId}` : 'Personne inconnue'); }
  reason(r:ScanReviewItem) { if(r.verdict==='DUPLICATE') return 'Doublon de service ou de journée'; if(r.verdict==='REJECTED_EXPIRED_ASSIGNMENT') return 'Badge remplacé ou affectation expirée'; if(r.verdict==='REJECTED_UNKNOWN') return 'Code inconnu'; if(r.verdict==='REJECTED_REVOKED') return 'Badge perdu ou révoqué'; return 'Scan tardif, refusé localement ou ambigu'; }
  examine(r:ScanReviewItem) { this.selected.set(r);this.note='';this.reviewError.set('');setTimeout(()=>document.getElementById('review-note')?.focus()); }
  cancelReview() { if(!this.saving()) this.selected.set(null); }
  closeReview() {
    const r=this.selected(); if(!r || this.saving() || this.note.trim().length<3) return;
    this.saving.set(true);this.reviewError.set('');
    this.saveSub=this.api.closeReview(r.id,this.note.trim()).subscribe({next:()=>{this.saving.set(false);this.selected.set(null);this.notice.set(`Vérification du scan #${r.id} close. Le verdict d'origine est conservé.`);this.refresh();},error:()=>{this.saving.set(false);this.reviewError.set('Clôture non confirmée. Votre note est conservée. Réessayez ou actualisez si le scan a déjà été traité.');}});
  }
}
