export interface Trip {
  id: number;
  date: string;
  driverId: number | null;
  origin: string | null;
  destination: string | null;
  status: 'scheduled' | 'in_transit' | 'delivered' | 'canceled';
  notes: string | null;
  departureTime: string | null;
  createdAt: string;
}
