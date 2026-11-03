import { useState } from "react";
import { FileText, UserRoundPen } from "lucide-react";
import { EmployeeForm } from "@/components/employee-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function EmployeeRegistration({ onSubmit }: { onSubmit: (data: FormData) => void }) {
  const [method, setMethod] = useState("ipa");

  return (
    <Tabs value={method} onValueChange={setMethod}>
      <TabsList className="grid h-auto w-full grid-cols-2">
        <TabsTrigger value="ipa" className="min-h-11 whitespace-normal px-2 text-center">
          <FileText className="mr-2 h-4 w-4 shrink-0" />
          Register by IPA
        </TabsTrigger>
        <TabsTrigger value="manual" className="min-h-11 whitespace-normal px-2 text-center">
          <UserRoundPen className="mr-2 h-4 w-4 shrink-0" />
          Register manually
        </TabsTrigger>
      </TabsList>
      <TabsContent value="ipa" className="mt-5">
        <div className="flex min-h-56 flex-col items-center justify-center gap-3 border border-dashed rounded-lg bg-muted/20 px-6 py-10 text-center">
          <FileText className="h-10 w-10 text-primary" />
          <h3 className="text-base font-semibold">IPA registration</h3>
          <p role="status" className="text-sm text-muted-foreground">Not available yet</p>
        </div>
      </TabsContent>
      <TabsContent forceMount value="manual" className="mt-5 data-[state=inactive]:hidden">
        <EmployeeForm onSubmit={onSubmit} />
      </TabsContent>
    </Tabs>
  );
}