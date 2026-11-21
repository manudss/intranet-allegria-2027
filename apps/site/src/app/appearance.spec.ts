import { TestBed } from '@angular/core/testing';
import { AppearanceControl, AppearanceService, APPEARANCE_KEY, resolveAppearance, validAppearance } from '@mej-allegria/appearance';

 describe('Appearance on every frontend', () => {
 let media: EventTarget & {matches:boolean};
 beforeEach(() => {
   localStorage.removeItem(APPEARANCE_KEY);
   media = Object.assign(new EventTarget(), {matches:true});
   vi.stubGlobal('matchMedia',vi.fn(()=>media as MediaQueryList));
 });
 afterEach(() => { TestBed.resetTestingModule(); vi.restoreAllMocks();vi.unstubAllGlobals();localStorage.removeItem(APPEARANCE_KEY); });
 it('validates storage and resolves only explicit modes or system auto', () => {
   expect(validAppearance('broken')).toBe('auto');expect(validAppearance(null)).toBe('auto');
   expect(resolveAppearance('auto',true)).toBe(true);expect(resolveAppearance('auto',false)).toBe(false);
   expect(resolveAppearance('light',true)).toBe(false);expect(resolveAppearance('dark',false)).toBe(true);
 });
 it('follows the system initially and when auto is restored', () => {
   const theme=TestBed.inject(AppearanceService);
   expect(theme.mode()).toBe('auto');expect(theme.dark()).toBe(true);
   theme.choose('light');media.dispatchEvent(new Event('change'));expect(theme.dark()).toBe(false);
   theme.choose('dark');media.matches=false;media.dispatchEvent(new Event('change'));expect(theme.dark()).toBe(true);
   theme.dark.reset();expect(theme.dark()).toBe(false);expect(theme.mode()).toBe('auto');
 });
 it('reads the explicit saved preference and updates the root together', () => {
   localStorage.setItem(APPEARANCE_KEY,'light');const theme=TestBed.inject(AppearanceService);
   expect(theme.dark()).toBe(false);expect(document.documentElement.dataset['theme']).toBe('light');
   theme.choose('dark');expect(document.documentElement.style.colorScheme).toBe('dark');
   expect(localStorage.getItem(APPEARANCE_KEY)).toBe('dark');
 });
 it('remains usable if storage throws on read and write', () => {
   vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('storage denied')});
   vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('storage denied')});
   const theme=TestBed.inject(AppearanceService);theme.choose('light');expect(theme.dark()).toBe(false);
 });
 it('syncs other tabs and storage clearing without a backend', () => {
   const theme=TestBed.inject(AppearanceService);theme.choose('light');
   window.dispatchEvent(new StorageEvent('storage',{key:APPEARANCE_KEY,newValue:'dark'}));expect(theme.dark()).toBe(true);
   window.dispatchEvent(new StorageEvent('storage',{key:null}));expect(theme.mode()).toBe('auto');
 });
 it('ignores media updates after destruction', () => {
   const theme=TestBed.inject(AppearanceService);TestBed.resetTestingModule();
   media.matches=false;media.dispatchEvent(new Event('change'));expect(theme.dark()).toBe(true);
 });
 it('exposes labelled keyboard-operable choices with a pressed state', async () => {
   await TestBed.configureTestingModule({imports:[AppearanceControl]}).compileComponents();
   const fixture=TestBed.createComponent(AppearanceControl);fixture.detectChanges();
   const buttons=[...fixture.nativeElement.querySelectorAll('button')] as HTMLButtonElement[];
   expect(buttons.length).toBe(3);buttons[0].click();fixture.detectChanges();
   expect(buttons[0].getAttribute('aria-pressed')).toBe('true');expect(buttons[1].getAttribute('aria-pressed')).toBe('false');
 });
 });
