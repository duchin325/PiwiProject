import { PartialType } from "@nestjs/mapped-types";
import { CreateClientDto } from "./create-client.dto";

//Esto marca todas las propiedades del createclientdto como opcionales
export class UpdateClientDto extends PartialType(CreateClientDto){};