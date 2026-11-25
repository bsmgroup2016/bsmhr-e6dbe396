import { supabase } from "@/integrations/supabase/client";
import type { HrBrainRequest, HrBrainResponse } from "@/core/hr-brain";

export type { HrBrainRequest, HrBrainResponse } from "@/core/hr-brain";

export function callHrBrain(input: HrBrainRequest & { stream: true }, signal?: AbortSignal): Promise<Response>;
export function callHrBrain(input: HrBrainRequest & { stream?: false }, signal?: AbortSignal): Promise<HrBrainResponse>;
export async function callHrBrain(input: HrBrainRequest, signal?: AbortSignal): Promise<Response | HrBrainResponse> {
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) throw new Error("Not signed in");
  const response = await fetch("/api/public/hr-brain", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(result?.error ?? `AI Brain request failed (HTTP ${response.status})`);
  }
  if (input.stream) return response;
  return response.json() as Promise<HrBrainResponse>;
}