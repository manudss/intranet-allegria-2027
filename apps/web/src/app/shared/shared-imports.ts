import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { FormsModule } from '@angular/forms';
import { FormField } from '@angular/forms/signals';
import { TuiItem } from '@taiga-ui/cdk';
import { TuiButton, TuiGroup, TuiIcon, TuiInput, TuiLabel, TuiRadio } from '@taiga-ui/core';
import { TuiBadge, TuiChevron, TuiDrawer, TuiSelect, TuiTextarea, TuiBlock } from '@taiga-ui/kit';
import { PageLayoutComponent } from './ui-components';
import { LoadingSkeletonComponent } from './loading-skeleton.component';
import { DataTableComponent } from './data-table';
import { EventDateSelectorComponent } from './event-date-selector/event-date-selector.component';

export const SHARED_IMPORTS = [
  CommonModule,
  ScrollingModule,
  FormsModule,
  FormField,
  PageLayoutComponent,
  LoadingSkeletonComponent,
  DataTableComponent,
  EventDateSelectorComponent,
  TuiButton,
  TuiIcon,
  TuiItem,
  TuiLabel,
  ...TuiInput,
  ...TuiTextarea,
  TuiChevron,
  TuiBadge,
  TuiDrawer,
  TuiGroup,
  TuiBlock,
  TuiSelect,
  ...TuiRadio,
];
