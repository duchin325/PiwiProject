import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateRouteCityDto } from './create-route-city.dto';

export class UpdateRouteCityDto extends PartialType(CreateRouteCityDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
