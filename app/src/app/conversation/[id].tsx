import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ChatView } from '@/components/chat-view';
import { useAuth } from '@/lib/auth';
import { markConversationRead, sendMessage, useConversation, useMembers } from '@/lib/chat';
import { useMembership, useTripClock } from '@/lib/trip';
import { mergeFeed } from '@/lib/unread';
import { space, usePalette } from '@/theme';

/** Guide: conversation with one booking. */
export default function Conversation() {
  const c = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { trip } = useMembership();
  const me = useAuth().session?.user.id ?? '';
  const clock = useTripClock(trip.timezone);
  const { messages } = useConversation(id);
  const traveller = useMembers(trip.id).find((m) => m.id === id);
  const latest = messages.at(-1)?.created_at;

  useEffect(() => {
    markConversationRead(id);
  }, [id, latest]);

  return (
    <ChatView
      header={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.m }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Takaisin" onPress={() => router.back()} hitSlop={10}>
            <Text style={{ color: c.fg, fontSize: 22, fontWeight: '700' }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: c.fg, fontSize: 17, fontWeight: '800' }}>{traveller?.display_name ?? 'Matkustaja'}</Text>
            <Text style={{ color: c.muted, fontSize: 13 }}>
              {[traveller?.room && `Huone ${traveller.room}`, traveller && `${traveller.party_size} hlö`, traveller?.phone].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>
      }
      feed={mergeFeed(messages, [])}
      me={me}
      timeZone={trip.timezone}
      today={clock.date}
      onSend={(body) => sendMessage(id, body)}
      placeholder={`Vastaa: ${traveller?.display_name ?? ''}`}
      empty="Ei vielä viestejä tämän varauksen kanssa."
    />
  );
}
