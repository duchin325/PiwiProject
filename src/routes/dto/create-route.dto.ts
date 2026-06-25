import { IsInt, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRouteDto {
  @Type(() => Number)
  @IsInt()
  tripId: number;

  @IsString()
  routeGeoJson: string;

  @IsOptional()
  @IsString()
  pdfUrl?: string;
}
