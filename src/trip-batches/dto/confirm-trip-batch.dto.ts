import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { TripBatchDirection } from './create-trip-batch.dto';
import { ConfirmTripBatchGroupDto } from './confirm-trip-batch-group.dto';

export class ConfirmTripBatchDto {
  @IsDateString()
  tripDate: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  routeName?: string;

  @IsEnum(TripBatchDirection)
  direction: TripBatchDirection;

  @IsString()
  @IsNotEmpty()
  originCity: string;

  @IsString()
  @IsNotEmpty()
  finalDestinationCity: string;

  @Type(() => Number)
  @IsInt()
  driverId: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConfirmTripBatchGroupDto)
  groups: ConfirmTripBatchGroupDto[];
}
