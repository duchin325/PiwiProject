import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export enum TripBatchDirection {
  IDA = 'ida',
  VUELTA = 'vuelta',
}

export enum TripBatchStatus {
  DRAFT = 'draft',
  CONFIRMED = 'confirmed',
  IN_TRANSIT = 'in_transit',
  COMPLETED = 'completed',
  CANCELED = 'canceled',
}

export class CreateTripBatchDto {
  @IsDateString()
  tripDate: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  routeName?: string;

  @IsString()
  @IsNotEmpty()
  originCity: string;

  @IsString()
  @IsNotEmpty()
  finalDestinationCity: string;

  @IsEnum(TripBatchDirection)
  direction: TripBatchDirection;

  @Type(() => Number)
  @IsInt()
  driverId: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
