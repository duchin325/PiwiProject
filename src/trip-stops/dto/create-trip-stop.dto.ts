import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { TripStopType } from '../trip-stop.interface';

export class CreateTripStopDto {
  @Type(() => Number)
  @IsInt()
  tripId: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  orderId?: number;

  @Type(() => Number)
  @IsInt()
  sequence: number;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsIn(['pickup', 'delivery', 'checkpoint', 'other'] as TripStopType[])
  stopType: TripStopType;

  @IsString()
  @IsNotEmpty()
  city: string;

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

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
