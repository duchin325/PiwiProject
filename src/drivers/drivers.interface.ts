export interface Driver {
  id: number;
  name: string;
  phone: string | null;
  licenseNumber: string;
  truckPlate: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
}
