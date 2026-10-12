export interface Order {
  id: number;
  clientId: number;
  origin: string;
  destination: string;
  originCity: string | null;
  destinationCity: string | null;
  weight: number;
  volume: number | null;
  status: 'pendiente' | 'asignada' | 'en tránsito' | 'entregado' | 'cancelado';
  createdAt: string;
  originAddress: string | null;
  destinationAddress: string | null;
  senderName: string | null;
  senderPhone: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  amountToCollect: number | null;
  notes: string | null;
}
