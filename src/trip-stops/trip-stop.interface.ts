export type TripStopType = 'pickup' | 'delivery' | 'checkpoint' | 'other';

export interface TripStop {
  id: number;
  tripId: number;
  orderId: number | null;
  sequence: number;
  name: string;
  stopType: TripStopType;
  city: string;
  address: string | null;
  contactName: string | null;
  contactPhone: string | null;
  scheduledTime: string | null;
  notes: string | null;
  cashOnDelivery: boolean;
  cashAmount: number | null;
  completed: boolean;
  createdAt: string;
}
