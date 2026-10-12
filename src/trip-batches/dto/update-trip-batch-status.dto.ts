import { IsEnum } from 'class-validator';
import { TripBatchStatus } from './create-trip-batch.dto';

export class UpdateTripBatchStatusDto {
  @IsEnum(TripBatchStatus, {
    message: `status debe ser uno de: ${Object.values(TripBatchStatus).join(', ')}`,
  })
  status: TripBatchStatus;
}
