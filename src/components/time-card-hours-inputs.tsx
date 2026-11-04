import { Input } from "@/components/ui/input";

export function TimeCardHoursInputs({ date, normalHours, otHours, disabled, onChange }: {
  date: string; normalHours: number; otHours: number; disabled: boolean;
  onChange: (patch: { normalHours?: number; otHours?: number }) => void;
}) {
  return <div className="flex flex-wrap gap-2 pt-2">
    {(["normalHours", "otHours"] as const).map(field => <label key={field} className="space-y-1">
      {field === "normalHours" ? "GW hrs" : "OT hrs"}
      <Input aria-label={`${field === "normalHours" ? "GW hrs" : "OT hrs"} ${date}`} type="number" min="0" step="0.25" className="h-8 w-20" value={field === "normalHours" ? normalHours : otHours} disabled={disabled} onChange={event => {
        const value = Number(event.target.value);
        if (Number.isFinite(value) && value >= 0) onChange({ [field]: value });
      }} />
    </label>)}
  </div>;
}