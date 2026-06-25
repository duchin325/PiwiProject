import { PartialType } from '@nestjs/mapped-types';
import { CreateTripStopDto } from './create-trip-stop.dto';

export class UpdateTripStopDto extends PartialType(CreateTripStopDto) {}
