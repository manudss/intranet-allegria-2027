import { Component } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ALLEGRIA_2027_EVENT_DATES } from './event-date.config';
import {
  EventDateSelectorComponent,
  EVENT_DATE_VALUE_PROVIDER,
} from './event-date-selector.component';
import { buildEventDateOptions } from './event-date.utils';

describe('EventDateSelectorComponent', () => {
  it('genere les dates prioritaires dans l ordre avec les 4 jours du rassemblement', () => {
    const options = buildEventDateOptions(ALLEGRIA_2027_EVENT_DATES);

    expect(options.map((option) => option.value)).toEqual([
      '2027-10-28',
      '2027-10-29',
      '2027-10-30',
      '2027-10-31',
      '2027-11-01',
      '2027-11-02',
      '2027-11-03',
      '2027-11-04',
    ]);
    expect(options[0].label).toContain('Preparation');
    expect(options[2].label).toContain('Jour 1 du rassemblement');
    expect(options[5].label).toContain('Jour 4 du rassemblement');
    expect(options[7].label).toContain('Rangement');
  });

  it('accepte le 2 decembre 2027 comme borne maximale', async () => {
    await TestBed.configureTestingModule({
      imports: [EventDateSelectorComponent],
      providers: [
        {
          provide: EVENT_DATE_VALUE_PROVIDER,
          useValue: { todayIsoDate: () => '2027-10-01' },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(EventDateSelectorComponent);
    fixture.componentRef.setInput('config', ALLEGRIA_2027_EVENT_DATES);
    fixture.componentRef.setInput('label', 'Date');
    fixture.componentInstance.writeValue('2027-12-02');
    fixture.detectChanges();

    expect(fixture.componentInstance.validate()).toBeNull();
  });

  it('repositionne une date sous la borne minimale sur la borne min', async () => {
    await TestBed.configureTestingModule({
      imports: [EventDateSelectorComponent],
      providers: [
        {
          provide: EVENT_DATE_VALUE_PROVIDER,
          useValue: { todayIsoDate: () => '2027-10-15' },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(EventDateSelectorComponent);
    fixture.componentRef.setInput('config', ALLEGRIA_2027_EVENT_DATES);
    fixture.componentRef.setInput('required', true);
    fixture.componentInstance.writeValue('2027-10-10');
    fixture.detectChanges();

    expect(fixture.componentInstance.validate()).toEqual({ dateOutOfRange: true });
    expect(fixture.componentInstance.currentValue).toBe('2027-10-10');
  });

  it('propage une date personnalisee via ngModel', async () => {
    @Component({
      standalone: true,
      imports: [FormsModule, EventDateSelectorComponent],
      template: `<app-event-date-selector [(value)]="value" [config]="config" />`,
    })
    class HostComponent {
      value = '2027-10-30';
      config = ALLEGRIA_2027_EVENT_DATES;
    }

    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        {
          provide: EVENT_DATE_VALUE_PROVIDER,
          useValue: { todayIsoDate: () => '2027-10-01' },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const selector = fixture.debugElement.children[0].componentInstance as EventDateSelectorComponent;
    selector.writeValue('__other_date__');
    fixture.detectChanges();
    selector.writeValue('2027-11-10');
    fixture.detectChanges();

    expect(fixture.componentInstance.value).toBe('2027-11-10');
  });

  it('fonctionne avec Reactive Forms et required', async () => {
    @Component({
      standalone: true,
      imports: [ReactiveFormsModule, EventDateSelectorComponent],
      template: `<app-event-date-selector
        [formControl]="control"
        [config]="config"
        [required]="true"
      />`,
    })
    class HostReactiveComponent {
      readonly control = new FormControl<string | null>(null, {
        validators: [Validators.required],
      });
      readonly config = ALLEGRIA_2027_EVENT_DATES;
    }

    await TestBed.configureTestingModule({
      imports: [HostReactiveComponent],
      providers: [
        {
          provide: EVENT_DATE_VALUE_PROVIDER,
          useValue: { todayIsoDate: () => '2027-10-01' },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(HostReactiveComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.control.invalid).toBe(true);
    fixture.componentInstance.control.setValue('2027-10-31');
    fixture.detectChanges();
    expect(fixture.componentInstance.control.value).toBe('2027-10-31');
  });

  it('preserve l heure en mode datetime-local', async () => {
    await TestBed.configureTestingModule({
      imports: [EventDateSelectorComponent],
      providers: [
        {
          provide: EVENT_DATE_VALUE_PROVIDER,
          useValue: { todayIsoDate: () => '2027-10-01' },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(EventDateSelectorComponent);
    fixture.componentRef.setInput('config', ALLEGRIA_2027_EVENT_DATES);
    fixture.componentRef.setInput('mode', 'datetime-local');
    fixture.componentInstance.writeValue('2027-10-31T09:30');
    fixture.detectChanges();

    const timeInput = fixture.nativeElement.querySelector('input[type="time"]') as HTMLInputElement;
    expect(timeInput.value).toBe('09:30');
  });
});
