import { useIsFocused } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

import { ChatView } from '@/components/chat-view';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { markAnnouncementsRead, markConversationRead, sendMessage, useAnnouncements, useConversation, useMembers } from '@/lib/chat';
import { deviceTimeZone, deviceToday } from '@/lib/time';
import { useMembership } from '@/lib/trip';
import { mergeFeed } from '@/lib/unread';
import { usePalette } from '@/theme';

/** Traveller: private chat with the trip's guide(s), with group announcements in the same feed. */
export default function Chat() {
  const c = usePalette();
  const { t } = useI18n();
  const { trip, id: conversationId } = useMembership();
  const me = useAuth().session?.user.id ?? '';
  const { messages } = useConversation(conversationId);
  const announcements = useAnnouncements(trip.id);
  const guides = useMembers(trip.id).filter((m) => m.role === 'guide');
  const feed = mergeFeed(messages, announcements);
  const latest = feed.at(-1)?.at;
  const focused = useIsFocused();

  // Everything on screen counts as read while the chat is open.
  useEffect(() => {
    if (!focused) return;
    markConversationRead(conversationId);
    markAnnouncementsRead(trip.id);
  }, [focused, latest, conversationId, trip.id]);

  const guideNames = guides.map((g) => g.display_name).join(', ');
  return (
    <ChatView
      header={
        <View style={{ gap: 2 }}>
          <Text style={{ color: c.fg, fontSize: 17, fontWeight: '800' }}>{guideNames ? t('guideNamed', { names: guideNames }) : t('guide')}</Text>
          <Text style={{ color: c.muted, fontSize: 13 }}>
            {guides[0]?.phone ? `${t('phone', { phone: guides[0].phone })} · ` : ''}
            {t('emergency')}
          </Text>
        </View>
      }
      feed={feed}
      me={me}
      timeZone={deviceTimeZone()}
      today={deviceToday()}
      onSend={(body) => sendMessage(conversationId, body)}
      placeholder={t('chatPlaceholder')}
      empty={t('chatEmpty')}
      quickReplies={[t('quickLate'), t('quickBoots')]}
    />
  );
}
