import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { TripStopType } from '../../trip-stops/trip-stop.interface';

export class ConfirmTripBatchStopDto {
  @Type(() => Number)
  @IsInt()
  orderId: number;

  @Type(() => Number)
  @IsInt()
  sequence: number;

  @IsOptional()
  @IsIn(['pickup', 'delivery', 'checkpoint', 'other'] as TripStopType[])
  stopType?: TripStopType;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  scheduledTime?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  cashOnDelivery?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cashAmount?: number;
}
