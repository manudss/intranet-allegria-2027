import { Directive, ElementRef, OnDestroy, OnInit, Renderer2, inject, signal } from '@angular/core';

let nextId = 0;

/**
 * Champs obligatoires, sans dépendre d'une bibliothèque de formulaire :
 * - astérisque sur le libellé (`field-required`) quand l'input porte l'attribut `required` ;
 * - aucune erreur avant que l'utilisateur ait quitté le champ ou validé (`field-pristine`) ;
 * - ensuite, si le champ est vide : bordure d'erreur, `aria-invalid="true"` et message
 *   « Champ obligatoire » relié au champ par `aria-describedby`.
 * Appliqué automatiquement à tout `tui-textfield` des écrans qui importent SHARED_IMPORTS.
 */
@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector -- appliqué à tous les champs Taiga
  selector: 'tui-textfield',
  standalone: true,
  host: {
    '[class.field-required]': 'required()',
    '[class.field-pristine]': '!touched()',
  },
})
export class RequiredFieldDirective implements OnInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly renderer = inject(Renderer2);
  readonly required = signal(false);
  readonly touched = signal(false);
  private message: HTMLElement | null = null;
  private readonly messageId = `champ-obligatoire-${nextId++}`;
  private readonly cleanups: (() => void)[] = [];

  ngOnInit(): void {
    const sync = () => {
      const input = this.input();
      this.required.set(!!input?.hasAttribute('required'));
      this.refresh();
    };
    this.cleanups.push(
      this.renderer.listen(this.host, 'focusout', () => {
        this.touched.set(true);
        sync();
      }),
      this.renderer.listen(this.host, 'input', sync),
      this.renderer.listen(this.host, 'change', sync),
      // Validation de la zone (formulaire ou fenêtre) : tout bouton cliqué ou Entrée.
      this.renderer.listen('document', 'click', (event: Event) => {
        const button = (event.target as HTMLElement | null)?.closest('button');
        const zone =
          this.host.closest('aside, tui-dialog, tui-drawer, [role="dialog"]') ?? this.host.closest('form');
        const label = button?.textContent?.trim() ?? '';
        if (button && zone?.contains(button) && !/^(Fermer|Annuler|Effacer)/i.test(label)) {
          this.touched.set(true);
          sync();
        }
      }),
    );
    queueMicrotask(sync);
    setTimeout(sync, 0);
  }

  ngOnDestroy(): void {
    this.cleanups.forEach((fn) => fn());
    this.message?.remove();
  }

  private input(): HTMLInputElement | HTMLTextAreaElement | null {
    return this.host.querySelector('input, textarea');
  }

  private refresh(): void {
    const input = this.input();
    if (!input) return;
    const invalid = this.required() && this.touched() && input.value.trim() === '';
    if (invalid) {
      input.setAttribute('aria-invalid', 'true');
      if (!this.message) {
        this.message = this.renderer.createElement('span') as HTMLElement;
        this.message.id = this.messageId;
        this.message.className = 'field-error-message';
        this.message.textContent = 'Champ obligatoire';
        this.host.insertAdjacentElement('afterend', this.message);
      }
      input.setAttribute('aria-describedby', this.messageId);
      this.renderer.addClass(this.host, 'field-invalid');
    } else {
      if (input.getAttribute('aria-describedby') === this.messageId) input.removeAttribute('aria-describedby');
      if (this.required()) input.setAttribute('aria-invalid', 'false');
      this.message?.remove();
      this.message = null;
      this.renderer.removeClass(this.host, 'field-invalid');
    }
  }
}
