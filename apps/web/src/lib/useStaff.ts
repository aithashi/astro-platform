import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session; // undefined = still loading
}

export interface Staff {
  user_id: string;
  display_name: string;
  role: "owner" | "admin";
}

export function useStaff(userId: string | undefined) {
  return useQuery({
    queryKey: ["staff", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("user_id, display_name, role")
        .eq("user_id", userId!)
        .eq("active", true)
        .maybeSingle();
      if (error) throw error;
      return data as Staff | null;
    },
  });
}
