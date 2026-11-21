import { Component, inject } from '@angular/core';
import { APPEARANCE_TEMPLATE, APPEARANCE_STYLES } from './appearance-view';
import { AppearanceService } from './appearance';

@Component({
 selector: 'app-appearance', standalone: true,
 template: APPEARANCE_TEMPLATE,
 styles: [APPEARANCE_STYLES],
})
export class AppearanceControl {
 readonly theme = inject(AppearanceService);
 readonly labels = {light:'Clair',dark:'Sombre',auto:'Automatique'};
 readonly choices = [ {value:'light' as const,label:'Clair'}, {value:'dark' as const,label:'Sombre'}, {value:'auto' as const,label:'Automatique'} ];
}
