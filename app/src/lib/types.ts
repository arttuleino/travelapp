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
};

export type Membership = {
  id: string;
  role: Role;
  display_name: string;
  booking_ref: string | null;
  party_size: number;
  room: string | null;
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
