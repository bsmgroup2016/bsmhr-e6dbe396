import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Bot, 
  Zap, 
  ShieldCheck, 
  AlertCircle,
  Key,
  Play,
  Trash2,
  Save,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Plus,
  Monitor
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAiConfig, updateAiKey, testAiProvider } from "@/lib/ai-settings.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

export function AiSettings({ visionOnly = false }: { visionOnly?: boolean }) {
  const queryClient = useQueryClient();
  const fetchConfig = useServerFn(getAiConfig);
  const saveKey = useServerFn(updateAiKey);
  const runTest = useServerFn(testAiProvider);

  const { data: config, isLoading } = useQuery({
    queryKey: ["ai-config"],
    queryFn: () => fetchConfig(),
  });

  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [tempKey, setTempKey] = useState("");
  const [tempModel, setTempModel] = useState("");
  const [isVision, setIsVision] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const saveMutation = useMutation({
    mutationFn: (vars: { provider: string; key?: string; model?: string; vision?: boolean; delete?: boolean }) => 
      saveKey({ data: vars }),
    onSuccess: (res: any) => {
      if (res.success) {
        toast.success(res.message || "Key settings updated");
        setEditingProvider(null);
        setIsAdding(false);
        setTempKey("");
        setTempModel("");
        queryClient.invalidateQueries({ queryKey: ["ai-config"] });
      } else {
        toast.error(res.error || "Failed to update key");
      }
    },

  });

  const testMutation = useMutation({
    mutationFn: (provider: string) => runTest({ data: { provider } }),
    onMutate: (provider) => setTestingProvider(provider),
    onSuccess: (res: any) => {
      setTestingProvider(null);
      if (res.success) {
        toast.success("Connection test successful!");
      } else {
        toast.error(`Test failed: ${res.error}`);
      }
    },

    onError: () => setTestingProvider(null),
  });

  if (isLoading || !config) return <div className="p-8 text-center">Loading AI configuration...</div>;

  const providers = visionOnly 
    ? config.providers.filter(p => p.name === "copyfish" || p.name === "copyshish") 
    : config.providers;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">{visionOnly ? "OCR Engine Management" : "AI & OCR Provider Management"}</h2>
        </div>
        
        <p className="text-sm text-muted-foreground mb-6">
          {visionOnly
            ? "Manage the dedicated OCR engine (Copyfish). Add, edit or test the API key used for document scanning."
            : "Configure API keys for AI and OCR providers. You can add, edit, or test connections to primary providers and specialized OCR engines."}
        </p>

        {!config.configured && (
          <div className="mb-6 rounded-lg bg-destructive/10 p-4 flex items-start gap-3 border border-destructive/20 text-destructive">
            <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Action Required</p>
              <p className="text-xs opacity-90">No AI providers have valid API keys. AI-powered features like document scanning will not work.</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {providers.map((p, index) => (
            <div 
              key={p.name} 
              className={`flex flex-col p-4 rounded-lg border bg-background/50 transition-all ${
                index === 0 && config.configured ? "border-primary/50 bg-primary/5 shadow-sm" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-muted">
                    <Key className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold capitalize">{p.name}</span>
                      {index === 0 && config.configured && <Badge className="bg-primary text-[10px] h-4">Active Primary</Badge>}
                      {p.vision && <Badge variant="secondary" className="text-[10px] h-4">Vision Ready</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{p.model}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 gap-1.5"
                    onClick={() => testMutation.mutate(p.name)}
                    disabled={testingProvider === p.name}
                  >
                    {testingProvider === p.name ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                    Test
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if(confirm(`Delete API key for ${p.name}?`)) {
                        saveMutation.mutate({ provider: p.name, delete: true });
                      }
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {editingProvider === p.name ? (
                <div className="mt-2 space-y-3 p-3 rounded-md bg-muted/50 border border-dashed">
                  <div className="space-y-1.5">
                    <Label className="text-xs">API Key</Label>
                    <div className="relative">
                      <Input 
                        type={showKey ? "text" : "password"}
                        placeholder="sk-..." 
                        className="pr-10"
                        value={tempKey}
                        onChange={(e) => setTempKey(e.target.value)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full w-10 hover:bg-transparent"
                        onClick={() => setShowKey(!showKey)}
                      >
                        {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditingProvider(null)}>Cancel</Button>
                    <Button 
                      size="sm" 
                      onClick={() => saveMutation.mutate({ provider: p.name, key: tempKey })}
                      disabled={!tempKey || saveMutation.isPending}
                    >
                      <Save className="h-3 w-3 mr-1.5" />
                      Save Key
                    </Button>
                  </div>
                </div>
              ) : (
                <div 
                  className="mt-1 flex items-center justify-between text-xs p-2 rounded bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    setEditingProvider(p.name);
                    setTempKey("");
                  }}
                >
                  <span className="text-muted-foreground flex items-center gap-2 italic">
                    <Key className="h-3 w-3" /> 
                    {p.name === 'lovable' ? 'Managed by System' : '••••••••••••••••••••'}
                  </span>
                  <span className="text-primary font-medium">Update Key</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {!isAdding ? (
          <Button 
            variant="outline" 
            className="w-full mt-6 border-dashed border-2 py-8 text-muted-foreground hover:text-primary hover:border-primary/50 flex flex-col gap-2"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="h-6 w-6" />
            <span>Add New Provider</span>
          </Button>
        ) : (
          <div className="mt-6 p-5 rounded-xl border-2 border-primary/20 bg-primary/5 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-2 mb-2">
              <Plus className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold uppercase tracking-wider">New Provider Details</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Provider Name (e.g. copyfish, custom)</Label>
                <Input 
                  placeholder="Enter name..." 
                  value={editingProvider || ""} 
                  onChange={(e) => setEditingProvider(e.target.value.toLowerCase())}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Model ID</Label>
                <Input 
                  placeholder="e.g. gpt-4o, llama-3..." 
                  value={tempModel} 
                  onChange={(e) => setTempModel(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">API Key</Label>
              <Input 
                type="password"
                placeholder="sk-..." 
                value={tempKey} 
                onChange={(e) => setTempKey(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-background border">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium">Vision Ready</p>
                  <p className="text-[10px] text-muted-foreground">Does this provider support OCR / image scanning?</p>
                </div>
              </div>
              <Switch checked={isVision} onCheckedChange={setIsVision} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => {
                setIsAdding(false);
                setEditingProvider(null);
                setTempKey("");
                setTempModel("");
              }}>Cancel</Button>
              <Button 
                size="sm" 
                disabled={!editingProvider || !tempKey || saveMutation.isPending}
                onClick={() => saveMutation.mutate({ 
                  provider: editingProvider!, 
                  key: tempKey,
                  model: tempModel,
                  vision: isVision
                })}
              >
                {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Save className="h-3 w-3 mr-1.5" />}
                Add Provider
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Infrastructure Status
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3 rounded-lg border bg-background/50 flex items-center justify-between">
            <span className="text-xs font-medium">Primary Gateway</span>
            <Badge variant="outline" className="text-[10px] text-green-500 border-green-500/20 bg-green-500/5">
              <CheckCircle2 className="h-3 w-3 mr-1" /> ONLINE
            </Badge>
          </div>
          <div className="p-3 rounded-lg border bg-background/50 flex items-center justify-between">
            <span className="text-xs font-medium">Fallback Chain</span>
            <Badge variant="outline" className="text-[10px] text-primary border-primary/20 bg-primary/5">
              {config.backups.length} BACKUPS
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
