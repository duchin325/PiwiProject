import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { TripBatchDirection } from './create-trip-batch.dto';

export class TripBatchSuggestionDto {
  @IsDateString()
  tripDate: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  routeName?: string;

  @IsEnum(TripBatchDirection)
  direction: TripBatchDirection;

  @Type(() => Number)
  @IsInt()
  driverId: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  originCity?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  finalDestinationCity?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  maxStopsPerCity?: number;
}
