import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export enum TripStatus {
  SCHEDULED = 'scheduled',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  CANCELED = 'canceled',
}

export class CreateTripDto {
  @IsDateString()
  date: string;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  driverId?: number;

  @IsString()
  @IsNotEmpty()
  origin: string;

  @IsString()
  @IsNotEmpty()
  destination: string;

  @IsEnum(TripStatus)
  status: TripStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
