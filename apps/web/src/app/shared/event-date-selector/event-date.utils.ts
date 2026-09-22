import { EventDateConfig } from './event-date.config';

export type EventDateSelectorMode = 'date' | 'datetime-local';
export type EventDatePriorityKind = 'preparation' | 'event' | 'cleanup';

export interface EventDateOption {
  readonly value: string;
  readonly label: string;
  readonly kind: EventDatePriorityKind;
}

const FRENCH_MONTHS = [
  'janvier',
  'fevrier',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'aout',
  'septembre',
  'octobre',
  'novembre',
  'decembre',
] as const;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export interface DateValueProvider {
  todayIsoDate(): string;
}

export class SystemDateValueProvider implements DateValueProvider {
  todayIsoDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

type ParsedDate = {
  readonly year: number;
  readonly month: number;
  readonly day: number;
};

function parseIsoDateParts(value: string): ParsedDate {
  if (!ISO_DATE_PATTERN.test(value)) {
    throw new Error(`Invalid ISO date: ${value}`);
  }

  const [yearRaw, monthRaw, dayRaw] = value.split('-');
  return {
    year: Number(yearRaw),
    month: Number(monthRaw),
    day: Number(dayRaw),
  };
}

export function isoDateToUtcDate(value: string): Date {
  const { year, month, day } = parseIsoDateParts(value);
  return new Date(Date.UTC(year, month - 1, day));
}

export function utcDateToIsoDate(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysToIsoDate(value: string, days: number): string {
  const date = isoDateToUtcDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return utcDateToIsoDate(date);
}

export function compareIsoDates(left: string, right: string): number {
  return left.localeCompare(right);
}

export function clampIsoDate(value: string, min: string, max: string): string {
  if (compareIsoDates(value, min) < 0) {
    return min;
  }

  if (compareIsoDates(value, max) > 0) {
    return max;
  }

  return value;
}

export function extractIsoDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (ISO_DATE_PATTERN.test(value)) {
    return value;
  }

  if (DATETIME_LOCAL_PATTERN.test(value)) {
    return value.slice(0, 10);
  }

  return null;
}

export function extractTimeFromDateTimeLocal(value: string | null | undefined): string {
  if (!value || !DATETIME_LOCAL_PATTERN.test(value)) {
    return '';
  }

  return value.slice(11, 16);
}

export function combineDateAndTime(date: string, time: string): string {
  const normalizedTime = /^\d{2}:\d{2}$/.test(time) ? time : '00:00';
  return `${date}T${normalizedTime}`;
}

export function isDateWithinRange(value: string, min: string, max: string): boolean {
  return compareIsoDates(value, min) >= 0 && compareIsoDates(value, max) <= 0;
}

export function formatFrenchEventDate(value: string): string {
  const { year, month, day } = parseIsoDateParts(value);
  const dayLabel = day === 1 ? '1er' : String(day);
  return `${dayLabel} ${FRENCH_MONTHS[month - 1]} ${year}`;
}

export function buildEventDateOptionLabel(
  date: string,
  kind: EventDatePriorityKind,
  details: { readonly eventIndex?: number },
): string {
  const prefix = formatFrenchEventDate(date);

  if (kind === 'preparation') {
    return `${prefix} - Preparation`;
  }

  if (kind === 'cleanup') {
    return `${prefix} - Rangement`;
  }

  return `${prefix} - Jour ${details.eventIndex ?? 1} du rassemblement`;
}

export function buildEventDateOptions(config: EventDateConfig): readonly EventDateOption[] {
  const values = new Map<string, EventDateOption>();

  for (let offset = config.preparationDaysBefore; offset >= 1; offset -= 1) {
    const date = addDaysToIsoDate(config.startDate, -offset);
    values.set(date, {
      value: date,
      label: buildEventDateOptionLabel(date, 'preparation', {}),
      kind: 'preparation',
    });
  }

  const totalEventDays = differenceInDaysInclusive(config.startDate, config.endDate);
  for (let index = 0; index < totalEventDays; index += 1) {
    const date = addDaysToIsoDate(config.startDate, index);
    values.set(date, {
      value: date,
      label: buildEventDateOptionLabel(date, 'event', { eventIndex: index + 1 }),
      kind: 'event',
    });
  }

  for (let offset = 1; offset <= config.cleanupDaysAfter; offset += 1) {
    const date = addDaysToIsoDate(config.endDate, offset);
    values.set(date, {
      value: date,
      label: buildEventDateOptionLabel(date, 'cleanup', {}),
      kind: 'cleanup',
    });
  }

  return [...values.values()].sort((left, right) => compareIsoDates(left.value, right.value));
}

export function getEventDateBounds(
  config: EventDateConfig,
  dateProvider: DateValueProvider,
): { readonly minDate: string; readonly maxDate: string } {
  const minDate = config.minDate ?? dateProvider.todayIsoDate();
  const maxDate = addDaysToIsoDate(config.endDate, config.maxDateOffsetDays ?? 30);
  return { minDate, maxDate };
}

function differenceInDaysInclusive(startDate: string, endDate: string): number {
  const start = isoDateToUtcDate(startDate);
  const end = isoDateToUtcDate(endDate);
  const diff = end.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000) + 1;
}
