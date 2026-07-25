import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { AppModule } from './app.module';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {
      return;
    },
    removeListener: () => {
      return;
    },
    addEventListener: () => {
      return;
    },
    removeEventListener: () => {
      return;
    },
    dispatchEvent: () => false,
  }),
});

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule],
    }).compileComponents();
  });

  it('should render intranet layout shell', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
    expect(compiled.querySelector('tui-root')).not.toBeNull();
  });
});
