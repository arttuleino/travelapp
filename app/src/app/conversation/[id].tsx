import { router, useLocalSearchParams } from 'expo-router';

import { ConversationPane } from '@/components/conversation-pane';

/** Guide: conversation with one booking (phone; on a wide window the inbox shows it beside the list). */
export default function Conversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ConversationPane id={id} onBack={() => router.back()} />;
}
