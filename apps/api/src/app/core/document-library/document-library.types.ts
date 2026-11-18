import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentFileType, DocumentLinkVisibility } from '../entities';

export class DocumentLinkQueryDto {
  @ApiPropertyOptional({ example: 'consignes' })
  search?: string;

  @ApiPropertyOptional({ example: 3 })
  categoryId?: number;
}

export class CreateDocumentLinkDto {
  @ApiProperty({ example: 'Guide ES animateurs' })
  title!: string;

  @ApiPropertyOptional({ example: 'Guide de préparation des animateurs ES' })
  description?: string;

  @ApiProperty({ example: 'https://mej.sharepoint.com/sites/allegria/guide-es.pdf' })
  url!: string;

  @ApiPropertyOptional({ enum: DocumentFileType, example: DocumentFileType.PDF })
  fileType?: DocumentFileType;

  @ApiPropertyOptional({ example: 3 })
  categoryId?: number;

  @ApiProperty({ enum: DocumentLinkVisibility, example: DocumentLinkVisibility.ALL })
  visibility!: DocumentLinkVisibility;

  @ApiPropertyOptional({ type: [Number], example: [1, 2] })
  teamIds?: number[];
}

export class UpdateDocumentLinkDto {
  @ApiPropertyOptional()
  title?: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiPropertyOptional()
  url?: string;

  @ApiPropertyOptional({ enum: DocumentFileType })
  fileType?: DocumentFileType;

  @ApiPropertyOptional()
  categoryId?: number | null;

  @ApiPropertyOptional({ enum: DocumentLinkVisibility })
  visibility?: DocumentLinkVisibility;

  @ApiPropertyOptional({ type: [Number] })
  teamIds?: number[];
}

export class CreateDocumentCategoryDto {
  @ApiProperty({ example: 'MUSIQUE' })
  code!: string;

  @ApiProperty({ example: 'Musique' })
  label!: string;

  @ApiPropertyOptional({ example: null })
  parentId?: number | null;

  @ApiPropertyOptional({ example: 10 })
  sortOrder?: number;

  @ApiPropertyOptional({ example: true })
  isActive?: boolean;
}

export class UpdateDocumentCategoryDto {
  @ApiPropertyOptional()
  code?: string;

  @ApiPropertyOptional()
  label?: string;

  @ApiPropertyOptional()
  parentId?: number | null;

  @ApiPropertyOptional()
  sortOrder?: number;

  @ApiPropertyOptional()
  isActive?: boolean;
}
