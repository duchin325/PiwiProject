export interface Order {
  id: number;
  clientId: number;
  origin: string;
  destination: string;
  weight: number;
  volume: number | null;
  status: 'pendiente' | 'en tránsito' | 'entregado';
  createdAt: string;
}
