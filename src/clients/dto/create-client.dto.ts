import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateClientDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  email: string;
}
