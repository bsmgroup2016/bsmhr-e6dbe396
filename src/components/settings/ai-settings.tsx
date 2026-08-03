import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Bot, 
  ChevronUp, 
  ChevronDown, 
  Eye, 
  EyeOff, 
  Zap, 
  ShieldCheck, 
  AlertCircle 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { getAiConfig, updateAiProviderPriority, toggleAiProvider } from "@/lib/ai-settings.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

export function AiSettings() {
  const queryClient = useQueryClient();
  const fetchConfig = useServerFn(getAiConfig);
  const updatePriority = useServerFn(updateAiProviderPriority);
  const toggleProvider = useServerFn(toggleAiProvider);

  const { data: config, isLoading } = useQuery({
    queryKey: ["ai-config"],
    queryFn: () => fetchConfig(),
  });

  const moveMutation = useMutation({
    mutationFn: (newOrder: string[]) => updatePriority({ data: { order: newOrder } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-config"] });
      toast.success("AI priority updated");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (vars: { name: string; enabled: boolean }) => 
      toggleProvider({ data: vars }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-config"] });
      toast.success("Provider status updated");
    },
  });

  if (isLoading || !config) return <div className="p-8 text-center">Loading AI configuration...</div>;

  const providers = config.providers;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">AI Provider Management</h2>
        </div>
        
        <p className="text-sm text-muted-foreground mb-6">
          Manage the fallback order and status of your AI providers. The system will automatically 
          try the first enabled provider and fall back to the next one if it fails or hits limits.
        </p>

        {!config.configured && (
          <div className="mb-6 rounded-lg bg-destructive/10 p-4 flex items-start gap-3 border border-destructive/20 text-destructive">
            <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-sm">No AI Providers Configured</p>
              <p className="text-xs opacity-90">Please add API keys in the environment variables (secrets) to enable AI features.</p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {providers.map((p, index) => (
            <div 
              key={p.name} 
              className={`flex items-center justify-between p-4 rounded-lg border bg-background/50 transition-all ${
                index === 0 ? "border-primary/50 bg-primary/5 shadow-sm" : ""
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6" 
                    disabled={index === 0}
                    onClick={() => {
                      const newOrder = [...providers.map(pr => pr.name)];
                      [newOrder[index], newOrder[index-1]] = [newOrder[index-1], newOrder[index]];
                      moveMutation.mutate(newOrder);
                    }}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6" 
                    disabled={index === providers.length - 1}
                    onClick={() => {
                      const newOrder = [...providers.map(pr => pr.name)];
                      [newOrder[index], newOrder[index+1]] = [newOrder[index+1], newOrder[index]];
                      moveMutation.mutate(newOrder);
                    }}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
                
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold capitalize">{p.name}</span>
                    {index === 0 && <Badge className="bg-primary hover:bg-primary/90 text-[10px] h-4">Primary</Badge>}
                    {p.vision && <Badge variant="secondary" className="text-[10px] h-4">Vision</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{p.model}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                  {index === 0 ? (
                    <span className="flex items-center gap-1 text-primary"><Zap className="h-3 w-3" /> Fastest</span>
                  ) : (
                    <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Fallback #{index}</span>
                  )}
                </div>
                <Switch 
                  defaultChecked 
                  onCheckedChange={(checked) => toggleMutation.mutate({ name: p.name, enabled: checked })}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h3 className="text-sm font-semibold mb-3">Fallback Rules</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="font-medium">Auto-retry on Rate Limit</p>
              <p className="text-xs text-muted-foreground">Retry next provider immediately on 429 error.</p>
            </div>
            <Switch defaultChecked disabled />
          </div>
          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="font-medium">Vision Routing</p>
              <p className="text-xs text-muted-foreground">Skip non-vision providers for scanned documents.</p>
            </div>
            <Switch defaultChecked disabled />
          </div>
          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="font-medium">Cost Optimization</p>
              <p className="text-xs text-muted-foreground">Prefer lower cost providers when logic complexity is low.</p>
            </div>
            <Switch />
          </div>
        </div>
      </div>
    </div>
  );
}
