import { supabase } from '../supabase';

type WithId = { id: string };

type SupabaseRow<T> = {
  id: string;
  business_id: string;
  data: T;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const fetchSettings = async <T>(table: string, businessId: string) => {
  const { data, error } = await supabase
    .from(table)
    .select('id, business_id, data')
    .eq('business_id', businessId);

  if (error) throw error;
  return (data ?? []) as SupabaseRow<T>[];
};

const upsertSettings = async <T extends WithId>(
  table: string,
  businessId: string,
  items: T[],
  createdBy?: string | null
) => {
  if (!items.length) return;
  const timestamp = new Date().toISOString();
  const rows = items.map((item) => ({
    id: item.id,
    business_id: businessId,
    created_by: createdBy ?? null,
    data: item,
    updated_at: timestamp,
  }));

  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id,business_id' });
  if (error) throw error;
};

const deleteSettings = async (table: string, businessId: string, ids: string[]) => {
  if (!ids.length) return;
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('business_id', businessId)
    .in('id', ids);
  if (error) throw error;
};

export const supabaseSettings = {
  fetchSettings,
  upsertSettings,
  deleteSettings,
};
