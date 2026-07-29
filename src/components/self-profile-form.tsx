import { useRef, useState } from "react";
import { Loader2, Send, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateEmployee } from "@/lib/store";
import { uploadToR2 } from "@/lib/r2";
import type { Employee } from "@/lib/types";

type Field = { key: keyof Employee; label: string; type?: string; area?: boolean };

const FIELDS: Field[] = [
  { key: "name", label: "Full name (as in passport)" },
  { key: "preferredName", label: "Preferred name" },
  { key: "nationality", label: "Nationality" },
  { key: "dateOfBirth", label: "Date of birth", type: "date" },
  { key: "gender", label: "Gender" },
  { key: "maritalStatus", label: "Marital status" },
  { key: "phone", label: "Mobile number" },
  { key: "altPhone", label: "Alternate number" },
  { key: "passportNumber", label: "Passport number" },
  { key: "passportExpiry", label: "Passport expiry", type: "date" },
  { key: "postalCode", label: "Postal code" },
  { key: "bankName", label: "Bank name" },
  { key: "bankAccount", label: "Bank account number" },
  { key: "accountHolderName", label: "Account holder name" },
  { key: "emergencyContact", label: "Emergency contact name" },
  { key: "emergencyRelation", label: "Relationship" },
  { key: "emergencyPhone", label: "Emergency phone" },
  { key: "emergencyEmail", label: "Emergency email" },
  { key: "address", label: "Address in Singapore", area: true },
  { key: "homeCountryAddress", label: "Home country address", area: true },
];

export function SelfProfileForm({
  employee,
  onSaved,
}: {
  employee: Employee;
  onSaved?: () => void;
}) {
  const [form, setForm] = useState<Partial<Employee>>({ ...employee });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (key: keyof Employee, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const value = (key: keyof Employee) => {
    const v = form[key];
    return typeof v === "string" ? v : "";
  };

  const pickPhoto = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadToR2(file, "photos", undefined, employee.id);
      setForm((f) => ({ ...f, photoUrl: res.url }));
      updateEmployee(employee.id, { photoUrl: res.url });
      toast.success("Photo uploaded");
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = (submitForReview: boolean) => {
    if (!String(form.name ?? "").trim()) {
      toast.error("Full name is required");
      return;
    }
    if (submitForReview && (!form.phone || !form.emergencyContact || !form.emergencyPhone)) {
      toast.error("Mobile number and emergency contact are required before submitting");
      return;
    }
    setSaving(true);
    const updates: Partial<Employee> = { ...form };
    if (submitForReview && employee.status === "Pending Profile Completion") {
      updates.status = "Pending Verification";
    }
    updateEmployee(employee.id, updates);
    setSaving(false);
    toast.success(
      submitForReview ? "Profile submitted for HR verification" : "Profile saved",
    );
    onSaved?.();
  };

  return (
    <div className="space-y-5 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-4">
        <div className="h-16 w-16 overflow-hidden rounded-full border bg-muted">
          {form.photoUrl ? (
            <img src={form.photoUrl} alt="Profile" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="gap-1"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload photo
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void pickPhoto(e.target.files?.[0])}
          />
          <p className="mt-1 text-xs text-muted-foreground">JPG or PNG, max 25 MB.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FIELDS.filter((f) => !f.area).map((f) => (
          <div key={String(f.key)} className="grid gap-1.5">
            <Label>{f.label}</Label>
            <Input
              type={f.type ?? "text"}
              value={value(f.key)}
              onChange={(e) => set(f.key, e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.filter((f) => f.area).map((f) => (
          <div key={String(f.key)} className="grid gap-1.5">
            <Label>{f.label}</Label>
            <Textarea value={value(f.key)} onChange={(e) => set(f.key, e.target.value)} />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={saving} onClick={() => save(false)}>
          Save changes
        </Button>
        <Button disabled={saving} onClick={() => save(true)} className="gap-1">
          <Send className="h-4 w-4" />
          Submit for verification
        </Button>
      </div>
    </div>
  );
}
