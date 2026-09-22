export interface EventDateConfig {
  readonly startDate: string;
  readonly endDate: string;
  readonly preparationDaysBefore: number;
  readonly cleanupDaysAfter: number;
  readonly minDate?: string;
  readonly maxDateOffsetDays?: number;
}

export const ALLEGRIA_2027_EVENT_DATES: EventDateConfig = {
  startDate: '2027-10-30',
  endDate: '2027-11-02',
  preparationDaysBefore: 2,
  cleanupDaysAfter: 2,
  maxDateOffsetDays: 30,
};
