import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateBy,
} from 'class-validator';
import type { PublicHostFamilyRegistrationPayload } from '@mej-allegria/shared';

const Trim = () =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

const WithinTotalCapacity = () =>
  ValidateBy({
    name: 'withinTotalCapacity',
    validator: {
      validate: (value: unknown, args) => {
        const total = (args?.object as CreatePublicHostFamilyRegistrationDto)?.maxCapacity;
        return typeof value === 'number' && typeof total === 'number' && value <= total;
      },
      defaultMessage: () => 'La capacité indiquée ne peut pas dépasser la capacité totale.',
    },
  });

export class CreatePublicHostFamilyRegistrationDto implements PublicHostFamilyRegistrationPayload {
  @ApiProperty({ example: 'Famille Bernard', maxLength: 160 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  familyName!: string;

  @ApiProperty({ example: '12 rue des Tilleuls', maxLength: 255 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  address!: string;

  @ApiProperty({ example: '42000', maxLength: 20 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  postalCode!: string;

  @ApiProperty({ example: 'Saint-Étienne', maxLength: 120 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  city!: string;

  @ApiProperty({ example: '+33601020304', maxLength: 40 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  phone!: string;

  @ApiProperty({ example: 'bernard@example.fr', maxLength: 255 })
  @Trim()
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 4, minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  maxCapacity!: number;

  @ApiProperty({ example: 3, minimum: 0 })
  @IsInt()
  @Min(0)
  @WithinTotalCapacity()
  maxUnder18!: number;

  @ApiPropertyOptional({ example: 1, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @WithinTotalCapacity()
  maxAnimators?: number;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(120)
  parish?: string;

  @ApiPropertyOptional({ type: [String], maxItems: 20 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((item: unknown) => (typeof item === 'string' ? item.trim() : item))
      : value,
  )
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(255, { each: true })
  constraints?: string[];

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ description: 'Champ anti-bot, doit rester vide' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  honeypot?: string;
}
