// hooks/useLegiWeak.ts
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "../utils/supabase";

type Result = { isWeak: boolean; isLoading: boolean; refetch: () => Promise<void> };

export function useLegiWeak(legislationId?: number | string): Result {
  const [isWeak, setIsWeak] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const idNum = useMemo(() => {
    if (legislationId == null) return undefined;
    const n = typeof legislationId === "string" ? parseInt(legislationId, 10) : legislationId;
    return Number.isFinite(n) ? n : undefined;
  }, [legislationId]);

  const load = async () => {
    if (!idNum) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from("legi_index")
      .select("weak")
      .eq("id", idNum)
      .maybeSingle();
    if (!error && data) setIsWeak(!!data.weak);
    setIsLoading(false);
  };

  useEffect(() => { load(); }, [idNum]);

  // Realtime subscription so UI auto-updates after markLegislationAsWeak
  useEffect(() => {
    if (!idNum) return;
    const channel = supabase
      .channel(`legi_index_weak_${idNum}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "legi_index", filter: `id=eq.${idNum}` },
        (payload: any) => {
          const nextWeak = !!payload.new?.weak;
          setIsWeak(nextWeak);
        }
      )
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [idNum]);

  return { isWeak, isLoading, refetch: load };
}
