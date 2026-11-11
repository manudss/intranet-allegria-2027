# Event date selector

## Dates officielles Allegria 2027

- Dimanche 31 octobre 2027
- Lundi 1er novembre 2027
- Mardi 2 novembre 2027
- Mercredi 3 novembre 2027

## Période autorisée

- date minimale : aujourd'hui ;
- date maximale : 2 decembre 2027 inclus ;
- la borne maximale est calculee a partir de la date de fin du rassemblement + 30 jours.

## Rôle du composant partagé

`app-event-date-selector` centralise la saisie des dates liees a l'organisation d'Allegria 2027.

Il doit etre utilise pour :

- les dates de preparation ;
- les dates du rassemblement ;
- les dates de rangement et de cloture ;
- les champs date seule ou date+heure lies a l'organisation evenementielle.

Il ne doit pas etre utilise pour :

- les dates de naissance ;
- les horodatages techniques ;
- les filtres d'audit sans lien metier avec le rassemblement ;
- les dates historiques ou importees depuis un systeme externe quand la contrainte metier est differente.

## Configuration centralisée

La source de verite se trouve dans :

- `apps/web/src/app/shared/event-date-selector/event-date.config.ts`

Configuration actuelle :

```ts
export const ALLEGRIA_2027_EVENT_DATES = {
  startDate: '2027-10-31',
  endDate: '2027-11-03',
  preparationDaysBefore: 2,
  cleanupDaysAfter: 2,
  maxDateOffsetDays: 30,
};
```

Toute modification des dates officielles doit passer par cette configuration.

## API du composant

```ts
<app-event-date-selector
  [config]="eventDateConfig"
  label="Date prevue"
  hint="Selectionnez une date de preparation, de rassemblement ou de rangement."
  [required]="true"
  mode="date"
/>
```

### Inputs

- `config` : configuration metier obligatoire ;
- `label` : libelle visible ;
- `hint` : aide contextuelle ;
- `required` : active le message de validation obligatoire ;
- `disabled` : desactive le controle ;
- `id`, `name`, `ariaDescribedBy` : accessibilite / integration formulaire ;
- `mode` : `date` ou `datetime-local`.

### Output

- `dateChange` : emet la valeur courante ou `null`.

### Valeur

- mode `date` : `YYYY-MM-DD`
- mode `datetime-local` : `YYYY-MM-DDTHH:mm`

Les dates sans heure restent independantes des fuseaux horaires.

## Exemple avec Reactive Forms

```ts
form = this.formBuilder.group({
  plannedDate: this.formBuilder.control<string | null>(null, {
    validators: [Validators.required],
  }),
});
```

```html
<app-event-date-selector
  formControlName="plannedDate"
  label="Date prevue"
  hint="Selectionnez une date de preparation, de rassemblement ou de rangement."
  [config]="eventDateConfig"
  [required]="true"
>
</app-event-date-selector>
```

## Accessibilité

- label associe au select principal ;
- hint et erreurs relies via `aria-describedby` ;
- mode clavier complet ;
- focus deplace automatiquement sur la date personnalisee quand `Autre date` est choisi ;
- les dates prioritaires sont distinguees par leur texte, pas seulement par la couleur ;
- fonctionnement mobile conserve via champs natifs `date` et `time`.

## Strategie de test

Les tests doivent couvrir au minimum :

- generation des dates prioritaires ;
- bornes min/max ;
- `ControlValueAccessor` ;
- selection d'une date prioritaire ;
- selection d'une autre date ;
- retour d'une date personnalisee vers une date prioritaire ;
- prise en charge du mode `datetime-local`.
