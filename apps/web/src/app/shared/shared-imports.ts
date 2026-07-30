import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { FormField } from '@angular/forms/signals';
import { TuiItem } from '@taiga-ui/cdk';
import {
  TuiButton,
  TuiDataList,
  TuiDropdownContent,
  TuiIcon,
  TuiInput,
  TuiLabel,
  TuiLoader,
} from '@taiga-ui/core';
import {
  TuiBadge,
  TuiChevron,
  TuiDrawer,
  TuiTextarea,
} from '@taiga-ui/kit';
import { PageLayoutComponent } from './ui-components';

export const SHARED_IMPORTS = [
  CommonModule,
  ScrollingModule,
  FormField,
  PageLayoutComponent,
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
] as const;
