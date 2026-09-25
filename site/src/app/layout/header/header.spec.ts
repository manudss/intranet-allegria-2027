import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Header } from './header';

describe('Header', () => {
  async function createFixture() {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Header);
    fixture.detectChanges();
    return fixture;
  }

  it('keeps the mobile navigation collapsed by default', async () => {
    const fixture = await createFixture();
    const burger = fixture.nativeElement.querySelector('.site-header__burger') as HTMLButtonElement;
    expect(burger.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens the mobile navigation when the burger button is activated', async () => {
    const fixture = await createFixture();
    const burger = fixture.nativeElement.querySelector('.site-header__burger') as HTMLButtonElement;

    burger.click();
    fixture.detectChanges();

    expect(burger.getAttribute('aria-expanded')).toBe('true');
    const nav = fixture.nativeElement.querySelector('#primary-navigation') as HTMLElement;
    expect(nav.classList.contains('site-header__nav--open')).toBe(true);
  });

  it('closes every open menu on Escape', async () => {
    const fixture = await createFixture();
    const burger = fixture.nativeElement.querySelector('.site-header__burger') as HTMLButtonElement;
    burger.click();
    fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(burger.getAttribute('aria-expanded')).toBe('false');
  });

  it('renders the "S’inscrire" call to action', async () => {
    const fixture = await createFixture();
    const button = fixture.nativeElement.querySelector('.site-header__register button') as HTMLButtonElement;
    expect(button.textContent).toContain('S’inscrire');
  });
});
