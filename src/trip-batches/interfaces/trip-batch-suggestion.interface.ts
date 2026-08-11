export interface CandidateOrderRow {
  id: number;
  origin: string;
  destination: string;
  originCity: string | null;
  destinationCity: string | null;
  originAddress: string | null;
  destinationAddress: string | null;
  senderName: string | null;
  senderPhone: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  amountToCollect: number | null;
  notes: string | null;
  createdAt: string;
}

export interface SuggestedStop {
  orderId: number;
  sequence: number;
  stopType: 'delivery' | 'pickup';
  city: string;
  address: string;
  contactName: string | null;
  contactPhone: string | null;
  cashOnDelivery: boolean;
  cashAmount: number;
  notes: string | null;
}

export interface SuggestedGroup {
  city: string;
  routeOrder: number;
  totalOrders: number;
  totalCashAmount: number;
  stops: SuggestedStop[];
}

export interface TripBatchSuggestion {
  tripDate: string;
  routeName: string;
  direction: string;
  originCity: string;
  finalDestinationCity: string;
  driverId: number;
  groups: SuggestedGroup[];
}
