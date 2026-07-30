import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { FormField } from '@angular/forms/signals';
import {
  TuiButton,
  TuiDataList,
  TuiDropdownContent,
  TuiIcon,
  TuiInput,
  TuiLabel,
  TuiLoader,
} from '@taiga-ui/core';
import {TuiBadge, TuiChevron, TuiDataListWrapper, TuiDrawer, TuiSelect, TuiTextarea, TuiTooltip} from '@taiga-ui/kit';
import { TuiItem } from '@taiga-ui/cdk';
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
    ...TuiSelect,
  TuiChevron,
    ...TuiDataListWrapper,
    ...TuiDataList,
  TuiTooltip,
  TuiDropdownContent,
  TuiBadge,
  TuiDrawer,
] as const;
