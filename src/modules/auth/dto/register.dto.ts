import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * DTO para registrar usuarios
 * - Valida estructura y tipos del request
 * - Mantiene el Controller limpio
 */
export class RegisterDto {
  @IsEmail({}, { message: 'email inválido' })
  email!: string;

  @IsString({ message: 'displayName debe ser string' })
  @MinLength(2, { message: 'displayName debe tener al menos 2 caracteres' })
  displayName!: string;

  @IsString({ message: 'password debe ser string' })
  @MinLength(6, { message: 'password debe tener al menos 6 caracteres' })
  password!: string;

  @IsOptional()
  @IsString({ message: 'phone debe ser string' })
  phone?: string;

  @IsOptional()
  @IsString({ message: 'companySection debe ser string' })
  companySection?: string;

  @IsOptional()
  @IsString({ message: 'jobTitle debe ser string' })
  jobTitle?: string;
}
