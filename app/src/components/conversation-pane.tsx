import { useEffect } from 'react';
import { Pressable, View } from 'react-native';

import { ChatView } from '@/components/chat-view';
import { Text } from '@/components/text';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { markConversationRead, sendMessage, useConversation, useMembers } from '@/lib/chat';
import { deviceTimeZone, deviceToday } from '@/lib/time';
import { useMembership } from '@/lib/trip';
import { mergeFeed } from '@/lib/unread';
import { space, usePalette } from '@/theme';

/** Guide: conversation with one booking. Without `onBack` (the desktop inbox) there is no back arrow. */
export function ConversationPane({ id, onBack }: { id: string; onBack?: () => void }) {
  const c = usePalette();
  const { t } = useI18n();
  const { trip } = useMembership();
  const me = useAuth().session?.user.id ?? '';
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
          {onBack ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('back')} onPress={onBack} hitSlop={10}>
              <Text style={{ color: c.fg, fontSize: 22, fontWeight: '700' }}>‹</Text>
            </Pressable>
          ) : null}
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: c.fg, fontSize: 17, fontWeight: '800' }}>{traveller?.display_name ?? t('traveller')}</Text>
            <Text style={{ color: c.muted, fontSize: 13 }}>
              {[traveller?.room && t('room', { room: traveller.room }), traveller && t('persons', { n: traveller.party_size }), traveller?.phone].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>
      }
      feed={mergeFeed(messages, [])}
      me={me}
      timeZone={deviceTimeZone()}
      today={deviceToday()}
      onSend={(body) => sendMessage(id, body)}
      placeholder={t('replyTo', { name: traveller?.display_name ?? '' })}
      empty={t('conversationEmpty')}
    />
  );
}
