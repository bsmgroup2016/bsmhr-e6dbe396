import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bot, Loader2, Send, Trash2, User } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { TrainingPanel } from "@/components/assistant/training-panel";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({
    meta: [
      { title: "Chatbot Training — BSM Workforce & Operations" },
      { name: "description", content: "Ask questions about workers, payroll, deployments, billing and more in plain language." },
      { property: "og:title", content: "Chatbot Training — BSM Workforce & Operations" },
      { property: "og:description", content: "Ask questions about workers, payroll, deployments, billing and more." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssistantPage,
});

function AssistantPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Chatbot Training</h1>
          <p className="text-sm text-muted-foreground">Teach the live chat assistant about your company. Everyone asks it questions from the chat button.</p>
        </div>
        <TrainingPanel />
      </div>
    </AppShell>
  );
}

