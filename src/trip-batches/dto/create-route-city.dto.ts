import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateRouteCityDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  routeName?: string;

  @IsString()
  @IsNotEmpty()
  cityName: string;

  @Type(() => Number)
  @IsInt()
  sequence: number;
}
