export interface TimeSlot {
  slotStart: string; // ISO 8601 string
  slotEnd: string;   // ISO 8601 string
  capacity: number;
  booked: number;
  status: 'open' | 'full' | 'closed';
}

export type OrderDeliveryMode = 'asap' | 'scheduled';

export interface SelectedSlotDetails {
  mode: OrderDeliveryMode;
  slotStart?: string;
  slotEnd?: string;
}