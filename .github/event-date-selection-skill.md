# Skill: Event date selection

For every new date field related to MEJ Allegria 2027:

1. Reuse the shared `app-event-date-selector`.
2. Use the centralized `ALLEGRIA_2027_EVENT_DATES` configuration.
3. Offer preparation, event, and cleanup dates first.
4. Respect the configured minimum and maximum dates.
5. Preserve date-only values as `YYYY-MM-DD`.
6. Preserve local datetime form values as `YYYY-MM-DDTHH:mm` when the field includes time.
7. Do not use `new Date('YYYY-MM-DD')` for event business dates.
8. Document any exception for unrelated or special-purpose date fields.
9. Add tests for priority dates, boundaries, and custom dates.
10. Keep keyboard accessibility and mobile compatibility.
