import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@allegria.local' })
  email!: string;

  @ApiProperty({ example: '*******' })
  password!: string;
}

export class CreateUserDto {
  @ApiProperty({ example: 'coordinateur.lyon@allegria.local' })
  email!: string;

  @ApiProperty({ example: 'Passw0rd#Secure' })
  password!: string;

  @ApiPropertyOptional({ example: true })
  isActive?: boolean;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'NouveauPass#2027' })
  password?: string;

  @ApiPropertyOptional({ example: false })
  isActive?: boolean;
}

export class CreateRoleDto {
  @ApiProperty({ example: 'HEALTH' })
  code!: string;

  @ApiProperty({ example: 'Equipe medicale' })
  label!: string;
}

export class AssignRoleDto {
  @ApiProperty({ example: 2 })
  roleId!: number;
}


