import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { FormField } from '@angular/forms/signals';
import { TuiItem } from '@taiga-ui/cdk';
import {
  TuiButton,
  TuiIcon,
  TuiInput,
  TuiLabel,
  TuiLoader,
} from '@taiga-ui/core';
import {
  TuiBadge,
  TuiChevron,
  TuiDrawer,
  TuiSelect,
  TuiTextarea,
} from '@taiga-ui/kit';
import { PageLayoutComponent } from './ui-components';
import { DataTableComponent } from './data-table';

export const SHARED_IMPORTS = [
  CommonModule,
  ScrollingModule,
  FormField,
  PageLayoutComponent,
  DataTableComponent,
  TuiButton,
  TuiIcon,
  TuiLoader,
  TuiItem,
  TuiLabel,
  ...TuiInput,
  ...TuiTextarea,
  TuiChevron,
  TuiBadge,
  TuiDrawer,
  TuiSelect,
] as const;
