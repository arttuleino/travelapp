import { supabase } from './supabase';
import { useLiveTable } from './trip';

// The guide's answer bank: answers to common questions. The AI guide answers from these.

export type Answer = { id: string; trip_id: string; question: string; answer: string; updated_at: string };

const answersQuery = (tripId: string) => supabase.from('answer_bank').select('*').eq('trip_id', tripId).order('updated_at', { ascending: false });

export function useAnswers(tripId: string) {
  return useLiveTable<Answer>('answer_bank', 'trip_id', tripId, answersQuery);
}

export async function saveAnswer(tripId: string, question: string, answer: string, id?: string) {
  const row = { question: question.trim(), answer: answer.trim() };
  const { error } = id
    ? await supabase.from('answer_bank').update(row).eq('id', id)
    : await supabase.from('answer_bank').insert({ ...row, trip_id: tripId });
  if (error) throw error;
}

export async function deleteAnswer(id: string) {
  const { error } = await supabase.from('answer_bank').delete().eq('id', id);
  if (error) throw error;
}
