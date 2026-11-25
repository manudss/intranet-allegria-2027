import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, it, expect } from 'vitest';
import { TuiTime } from '@taiga-ui/cdk';
import { EventQuickEditorComponent } from './event-quick-editor';
import {
  ProgramApiService,
  GroupsApiService,
  VolunteerTeamsApiService,
} from '../../../services/api.services';
describe('Quick editor explicit 24-hour times', () => {
  it('displays and stores 13:15 without browser AM/PM locale', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ProgramApiService, useValue: {} },
        { provide: GroupsApiService, useValue: {} },
        { provide: VolunteerTeamsApiService, useValue: {} },
        { provide: Router, useValue: {} },
      ],
    });
    const c = TestBed.runInInjectionContext(() => new EventQuickEditorComponent());
    expect(c.timeValue('13:15')?.toString('HH:MM')).toBe('13:15');
    c.start.set('12:05');
    expect(c.startTimeValue()).toBe(c.startTimeValue());
    c.setTime('end', new TuiTime(13, 15));
    expect(c.end()).toBe('13:15');
    c.setTime('start', null);
    expect(c.start()).toBe('');
  });
});
