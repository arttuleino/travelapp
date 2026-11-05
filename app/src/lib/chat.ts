import { supabase } from './supabase';
import { useLiveTable } from './trip';
import type { Announcement, Member, Message } from './types';
import { unreadAnnouncements, unreadCount } from './unread';

// Stable query functions for useLiveTable.
const conversationQuery = (conversationId: string) =>
  supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at');
const tripMessagesQuery = (tripId: string) => supabase.from('messages').select('*').eq('trip_id', tripId).order('created_at');
const announcementsQuery = (tripId: string) => supabase.from('announcements').select('*').eq('trip_id', tripId).order('send_at');
const readsQuery = (userId: string) => supabase.from('conversation_reads').select('conversation_id, last_read_at').eq('user_id', userId);
const announcementReadsQuery = (userId: string) =>
  supabase.from('announcement_reads').select('trip_id, last_read_at').eq('user_id', userId);
const membersQuery = (tripId: string) => supabase.from('trip_members').select('*').eq('trip_id', tripId).order('display_name');

type Read = { conversation_id: string; last_read_at: string };
type AnnouncementRead = { trip_id: string; last_read_at: string };

export function useConversation(conversationId: string) {
  const { rows, loading } = useLiveTable<Message>('messages', 'conversation_id', conversationId, conversationQuery);
  return { messages: rows, loading };
}

/**
 * The trip's announcements, oldest first. Travellers get only those already sent (the database
 * hides scheduled ones); guides get scheduled ones too. Polls each minute so scheduled ones appear on time.
 */
export function useAnnouncements(tripId: string) {
  return useLiveTable<Announcement>('announcements', 'trip_id', tripId, announcementsQuery, 60_000).rows;
}

/** Only announcements that have gone out (for guides, who can also see scheduled ones). */
export const sentOnly = (items: Announcement[], now = new Date().toISOString()) => items.filter((a) => a.send_at <= now);

export function useTripMessages(tripId: string) {
  return useLiveTable<Message>('messages', 'trip_id', tripId, tripMessagesQuery).rows;
}

/** For guides: everyone on the trip. Travellers only see themselves and their guides. */
export function useMembers(tripId: string) {
  return useLiveTable<Member>('trip_members', 'trip_id', tripId, membersQuery).rows;
}

export function useReadMarkers(userId: string) {
  const reads = useLiveTable<Read>('conversation_reads', 'user_id', userId, readsQuery).rows;
  const annReads = useLiveTable<AnnouncementRead>('announcement_reads', 'user_id', userId, announcementReadsQuery).rows;
  return {
    conversation: (id: string) => reads.find((r) => r.conversation_id === id)?.last_read_at ?? null,
    announcements: (tripId: string) => annReads.find((r) => r.trip_id === tripId)?.last_read_at ?? null,
  };
}

/** Unread items for a traveller: guide replies in their own conversation plus group announcements. */
export function useTravellerUnread(tripId: string, conversationId: string, userId: string): number {
  const { messages } = useConversation(conversationId);
  const announcements = useAnnouncements(tripId);
  const reads = useReadMarkers(userId);
  return (
    unreadCount(messages, reads.conversation(conversationId), userId) +
    unreadAnnouncements(announcements, reads.announcements(tripId), userId)
  );
}

/** Unread traveller messages per conversation, for the guide's inbox. */
export function useGuideUnread(tripId: string, userId: string) {
  const messages = useTripMessages(tripId);
  const reads = useReadMarkers(userId);
  const byConversation = new Map<string, Message[]>();
  for (const m of messages) byConversation.set(m.conversation_id, [...(byConversation.get(m.conversation_id) ?? []), m]);
  const unread = (id: string) => unreadCount(byConversation.get(id) ?? [], reads.conversation(id), userId);
  const total = [...byConversation.keys()].reduce((sum, id) => sum + unread(id), 0);
  return { messages, byConversation, unread, total };
}

export async function sendMessage(conversationId: string, body: string) {
  // trip_id, sender and timestamps are filled in by the database from the sender's own membership.
  const { error } = await supabase.from('messages').insert({ conversation_id: conversationId, body: body.trim() });
  if (error) throw error;
}

export async function markConversationRead(conversationId: string) {
  await supabase.rpc('mark_conversation_read', { conv: conversationId });
}

export async function markAnnouncementsRead(tripId: string) {
  await supabase.rpc('mark_announcements_read', { t: tripId });
}
