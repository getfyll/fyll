import { supabase } from '../supabase';
type WithId = { id: string };

type SupabaseRow<T> = {
  id: string;
  business_id: string;
  data: T;
  created_at?: string | null;
  updated_at?: string | null;
};

const upsertCollection = async <T extends WithId>(
  table: string,
  businessId: string,
  items: T[]
) => {
  if (!items.length) return;
  const timestamp = new Date().toISOString();
  const rows = items.map((item) => ({
    id: item.id,
    business_id: businessId,
    data: item,
    updated_at: timestamp,
  }));

  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id,business_id' });
  if (error) throw error;
};

const deleteByIds = async (table: string, businessId: string, ids: string[]) => {
  if (!ids.length) return;
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('business_id', businessId)
    .in('id', ids);
  if (error) throw error;
};

const fetchCollection = async <T>(table: string, businessId: string) => {
  const { data, error } = await supabase
    .from(table)
    .select('id, data, business_id')
    .eq('business_id', businessId);

  if (error) throw error;
  return (data ?? []) as SupabaseRow<T>[];
};

export const supabaseData = {
  fetchCollection,
  upsertCollection,
  deleteByIds,
};
