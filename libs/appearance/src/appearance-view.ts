export const APPEARANCE_TEMPLATE = `<details class="appearance"><summary>Apparence : {{ labels[theme.mode()] }}</summary>
 <fieldset><legend>Apparence sur cet appareil</legend>
 @for (choice of choices; track choice.value) {
 <button type="button" [attr.aria-pressed]="theme.mode() === choice.value" (click)="theme.choose(choice.value)">{{ choice.label }}</button>
 }
 <p>Automatique suit le thème de votre appareil.</p></fieldset></details>`;
export const APPEARANCE_STYLES = `:host{display:block;font:inherit;color:var(--appearance-text);max-width:100%}
 details{position:relative}summary{cursor:pointer;min-height:44px;display:flex;align-items:center;padding:0 12px;border:1px solid var(--appearance-border);border-radius:8px;font-size:14px;font-weight:600;color:var(--appearance-action);background:var(--appearance-surface)}
 fieldset{position:absolute;z-index:200;right:0;top:100%;width:min(280px,calc(100vw - 40px));margin:8px 0 0;padding:16px;background:var(--appearance-surface);color:var(--appearance-text);border:1px solid var(--appearance-border);border-radius:12px;box-shadow:0 8px 24px #0003;box-sizing:border-box}
 legend{float:left;width:100%;font-size:14px;font-weight:700;margin-bottom:12px}button{font:inherit;font-size:14px;min-height:44px;padding:8px 12px;margin:3px;border:1px solid var(--appearance-border);border-radius:6px;background:var(--appearance-surface);color:var(--appearance-text);cursor:pointer}button[aria-pressed=true]{background:var(--appearance-selected);color:var(--appearance-action);border-color:currentColor;font-weight:700}p{font-size:12px;line-height:1.5;margin:10px 0 0}button:focus-visible,summary:focus-visible{outline:3px solid var(--appearance-focus);outline-offset:3px}
 @media(max-width:900px){fieldset{position:static;width:100%}}`;
