import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { FormField } from '@angular/forms/signals';
import { TuiButton, TuiDropdownContent, TuiIcon, TuiLabel, TuiLoader, TuiTextfieldComponent, TuiTextfieldMultiComponent, TuiTextfieldOptionsDirective } from '@taiga-ui/core';
import { TuiBadge, TuiDrawer } from '@taiga-ui/kit';
import { TuiItem } from '@taiga-ui/cdk';
import { PageLayoutComponent } from './ui-components';

@NgModule({
  imports: [
    CommonModule,
    ScrollingModule,
    FormField,
    PageLayoutComponent,
    TuiButton,
    TuiIcon,
    TuiLoader,
    TuiItem,
    TuiLabel,
    TuiTextfieldComponent,
    TuiTextfieldOptionsDirective,
    TuiTextfieldMultiComponent,
    TuiDropdownContent,
    TuiBadge,
    TuiDrawer,
  ],
  exports: [
    CommonModule,
    ScrollingModule,
    FormField,
    PageLayoutComponent,
    TuiButton,
    TuiIcon,
    TuiLoader,
    TuiItem,
    TuiLabel,
    TuiTextfieldComponent,
    TuiTextfieldOptionsDirective,
    TuiTextfieldMultiComponent,
    TuiDropdownContent,
    TuiBadge,
    TuiDrawer,
  ],
})
export class SharedModule {}
