import { useState, useEffect } from "react";
import { 
  AlertCircle, 
  CheckCircle2, 
  FileWarning, 
  Loader2, 
  ArrowRight,
  Info
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { readSpreadsheet } from "@/lib/xlsx";
import { getEmployees } from "@/lib/store";

interface ValidationError {
  row: number;
  column: string;
  message: string;
  type: "error" | "warning";
  value?: string;
}

interface ImportValidationDialogProps {
  file: File | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: any[]) => void;
}

export function ImportValidationDialog({ file, isOpen, onClose, onConfirm }: ImportValidationDialogProps) {
  const [validating, setValidating] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [data, setData] = useState<any[]>([]);
  const employees = getEmployees();

  useEffect(() => {
    if (file && isOpen) {
      void validateFile(file);
    } else {
      setErrors([]);
      setData([]);
    }
  }, [file, isOpen]);

  async function validateFile(file: File) {
    setValidating(true);
    setErrors([]);
    try {
      const rows = await readSpreadsheet(file);
      const validationErrors: ValidationError[] = [];
      const validData: any[] = [];

      // Validation logic
      rows.forEach((row, index) => {
        const rowNum = index + 2; // +1 for 0-index, +1 for header
        
        // Required columns check (normalized by readSpreadsheet)
        const required = ["date", "p-file number", "check in", "check out"];
        required.forEach(col => {
          if (!row[col]) {
            validationErrors.push({
              row: rowNum,
              column: col,
              message: "Missing required value",
              type: "error"
            });
          }
        });

        // Date format check (YYYY-MM-DD)
        if (row["date"] && !/^\d{4}-\d{2}-\d{2}$/.test(row["date"])) {
           validationErrors.push({
            row: rowNum,
            column: "date",
            message: "Invalid date format. Expected YYYY-MM-DD",
            type: "error",
            value: row["date"]
          });
        }

        // Employee matching
        if (row["p-file number"]) {
          const emp = employees.find(e => e.employeeCode.toLowerCase() === row["p-file number"].toLowerCase());
          if (!emp) {
            validationErrors.push({
              row: rowNum,
              column: "p-file number",
              message: "Employee code not found in system",
              type: "warning",
              value: row["p-file number"]
            });
          }
        }

        validData.push(row);
      });

      setErrors(validationErrors);
      setData(validData);
    } catch (e) {
      setErrors([{
        row: 0,
        column: "File",
        message: "Failed to read spreadsheet file",
        type: "error"
      }]);
    } finally {
      setValidating(false);
    }
  }

  const errorCount = errors.filter(e => e.type === "error").length;
  const warningCount = errors.filter(e => e.type === "warning").length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileWarning className="h-5 w-5 text-primary" />
            Import Validation
          </DialogTitle>
          <DialogDescription>
            Validating data for {file?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {validating ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analysing spreadsheet structure and data...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1 rounded-lg border bg-muted/30 p-3 text-center">
                  <div className="text-2xl font-bold">{data.length}</div>
                  <div className="text-xs text-muted-foreground uppercase font-semibold text-[10px]">Total Rows</div>
                </div>
                <div className={`flex-1 rounded-lg border p-3 text-center ${errorCount > 0 ? 'bg-destructive/10 border-destructive/20' : 'bg-success/10 border-success/20'}`}>
                  <div className={`text-2xl font-bold ${errorCount > 0 ? 'text-destructive' : 'text-success'}`}>{errorCount}</div>
                  <div className="text-xs text-muted-foreground uppercase font-semibold text-[10px]">Errors</div>
                </div>
                <div className="flex-1 rounded-lg border bg-warning/10 border-warning/20 p-3 text-center text-warning">
                  <div className="text-2xl font-bold">{warningCount}</div>
                  <div className="text-xs text-muted-foreground uppercase font-semibold text-[10px]">Warnings</div>
                </div>
              </div>

              <ScrollArea className="h-[300px] rounded-md border p-4">
                {errors.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <CheckCircle2 className="h-10 w-10 text-success mb-2" />
                    <p className="font-medium text-success">Validation Passed</p>
                    <p className="text-sm text-muted-foreground">All rows are valid and ready for verification.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {errors.map((error, i) => (
                      <div key={i} className="flex items-start gap-3 rounded-lg border bg-card p-3 text-sm">
                        {error.type === 'error' ? (
                          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        ) : (
                          <Info className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[12px]">Row {error.row}</span>
                            <Badge variant={error.type === 'error' ? 'destructive' : 'outline'} className="text-[9px] h-4">
                              {error.column}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground mt-1 text-[11px]">{error.message}</p>
                          {error.value && (
                            <code className="mt-1 block rounded bg-muted px-1 py-0.5 text-[10px]">
                              Value: "{error.value}"
                            </code>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button 
            disabled={validating || errorCount > 0} 
            onClick={() => onConfirm(data)}
          >
            Start Verification
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
