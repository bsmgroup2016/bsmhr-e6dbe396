import { Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import directoryFormat from "@/assets/staff-directory-format.xlsx.asset.json";
import attendanceFormat from "@/assets/staff-attendance-format.xlsx.asset.json";
import payrollFormat from "@/assets/staff-payroll-format.xlsx.asset.json";

const formats = { directory: directoryFormat, attendance: attendanceFormat, payroll: payrollFormat };

export function StaffExcelActions({ section, onExport }: {
  section: keyof typeof formats;
  onExport: () => Promise<void>;
}) {
  const format = formats[section];
  return <div className="flex flex-wrap items-center gap-2">
    <Button size="sm" variant="outline" asChild>
      <a href={format.url} download={format.original_filename}>
        <FileSpreadsheet className="mr-2 h-4 w-4" /> Upload format
      </a>
    </Button>
    <Button size="sm" variant="outline" onClick={() => void onExport()}>
      <Download className="mr-2 h-4 w-4" /> Export Excel
    </Button>
  </div>;
}