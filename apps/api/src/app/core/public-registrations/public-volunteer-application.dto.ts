import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type { PublicVolunteerApplicationPayload } from '@mej-allegria/shared';

export class CreatePublicVolunteerApplicationDto implements PublicVolunteerApplicationPayload {
  @ApiProperty({ example: 'Julien' })
  @IsString()
  @MaxLength(120)
  firstName!: string;

  @ApiProperty({ example: 'Martin' })
  @IsString()
  @MaxLength(120)
  lastName!: string;

  @ApiProperty({ example: 'julien.martin@example.fr' })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: '+33601020304' })
  @IsString()
  @MaxLength(40)
  phone!: string;

  @ApiPropertyOptional({ type: [String], example: ['accueil', 'logistique'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  missionsOfInterest?: string[];

  @ApiPropertyOptional({ example: 'Disponible les 4 jours, arrivée possible la veille.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  availability?: string;

  @ApiPropertyOptional({ example: "Envie de rejoindre l'équipe accueil pour vivre Alegria autrement." })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  motivation?: string;

  /** Champ honeypot : ne doit jamais être rempli par un humain. */
  @ApiPropertyOptional({ description: 'Champ anti-bot, doit rester vide' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  honeypot?: string;
}
