import { CalendarDays, CalendarRange, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AttendanceViewControlsProps {
  view: "day" | "month";
  date: string;
  month: string;
  search: string;
  onViewChange: (value: "day" | "month") => void;
  onDateChange: (value: string) => void;
  onMonthChange: (value: string) => void;
  onSearchChange: (value: string) => void;
}

export function AttendanceViewControls(props: AttendanceViewControlsProps) {
  return (
    <div className="flex flex-col gap-4 border-b pb-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Attendance view" className="inline-flex rounded-lg border bg-muted/50 p-1">
          <Button variant={props.view === "day" ? "default" : "ghost"} size="sm" aria-pressed={props.view === "day"} onClick={() => props.onViewChange("day")}><CalendarDays />Daily</Button>
          <Button variant={props.view === "month" ? "default" : "ghost"} size="sm" aria-pressed={props.view === "month"} onClick={() => props.onViewChange("month")}><CalendarRange />Monthly</Button>
        </div>
        <Input aria-label={props.view === "day" ? "Attendance date" : "Attendance month"} type={props.view === "day" ? "date" : "month"} value={props.view === "day" ? props.date : props.month} onChange={(event) => props.view === "day" ? props.onDateChange(event.target.value) : props.onMonthChange(event.target.value)} className="w-44" />
      </div>
      <div className="relative w-full xl:max-w-sm">
        <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label="Search attendance" type="search" placeholder="Search name or P-File Number" value={props.search} onChange={(event) => props.onSearchChange(event.target.value)} className="pl-9" />
      </div>
    </div>
  );
}