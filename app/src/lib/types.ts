export type Role = 'traveller' | 'guide';

export type Trip = {
  id: string;
  name: string;
  destination: string;
  country: string | null;
  starts_on: string;
  ends_on: string;
  timezone: string;
  hotel_name: string | null;
  hotel_stars?: number | null;
  hotel_address?: string | null;
  hotel_phone?: string | null;
  hotel_lift_distance?: string | null;
  check_in_time?: string | null; // 'HH:MM:SS' on starts_on
  check_out_time?: string | null; // 'HH:MM:SS' on ends_on
};

export type Flight = {
  id: string;
  trip_id: string;
  direction: 'out' | 'return';
  flight_date: string;
  flight_no: string;
  airline: string | null;
  dep_code: string;
  dep_city: string | null;
  dep_time: string;
  arr_code: string;
  arr_city: string | null;
  arr_time: string;
  terminal: string | null;
  baggage: string | null;
  transfer: string | null;
};

export type Membership = {
  id: string;
  role: Role;
  display_name: string;
  booking_ref: string | null;
  party_size: number;
  room: string | null;
  /** Booking market (FI, SE, NO): which customer service to show. */
  market: string | null;
  /** Room type and board, e.g. "Kahden hengen huone, parveke, puolihoito". */
  room_type?: string | null;
  trip: Trip;
};

export type ProgrammeItem = {
  id: string;
  trip_id: string;
  day: string;
  starts_at: string; // 'HH:MM:SS'
  title: string;
  details: string;
  previous_starts_at: string | null;
};

export type Announcement = {
  id: string;
  trip_id: string;
  title: string;
  body: string;
  author_name: string | null;
  created_by: string | null;
  created_at: string;
  /** When travellers see it; later than now = scheduled. */
  send_at: string;
  /** Set when the text was changed after it went out. */
  edited_at: string | null;
};

export type Message = {
  id: string;
  trip_id: string;
  conversation_id: string; // the traveller's trip_members.id
  sender_id: string | null;
  sender_role: Role;
  sender_name: string;
  body: string;
  created_at: string;
};

export type Member = {
  id: string;
  trip_id: string;
  email: string;
  role: Role;
  display_name: string;
  booking_ref: string | null;
  party_size: number;
  room: string | null;
  phone: string | null;
};
