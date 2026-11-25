# Claude দিয়ে Excel কাজ — পরিকল্পনা

## মূল নীতি (আগের নিয়ম বজায় থাকবে)
- বেতন, ঘণ্টা, OT ও claim-এর হিসাব software-ই করবে, আগের মতোই নির্দিষ্ট নিয়মে। Claude নিজে কোনো টাকা বা ঘণ্টা ঠিক করবে না, বদলাবেও না।
- Claude-এর কাজ হবে Excel-কে "smart" বানানো: formula, lookup, pivot, summary sheet ডিজাইন করা আর ভুল ধরা।
- আপনার claim template ও salary sheet-এর layout যেমন আছে তেমনই থাকবে।

## Claude কী কী করবে
1. **Claim Summary workbook**: সব claim sheet থেকে একটি summary sheet, যেখানে আসল ফর্মুলা থাকবে (SUMIFS, XLOOKUP, VLOOKUP), যাতে Excel খুললে সংখ্যা live হয়।
2. **Pivot / Analysis sheet**: কোম্পানি, project, worker ও মাস অনুযায়ী pivot-ধরনের summary (Pivot Table বা SUMIFS grid)।
3. **Combined Claim → Salary Sheet**: salary sheet-এর কলামগুলো combined claim sheet থেকে XLOOKUP দিয়ে টেনে আনবে (worker ID / P-File Number দিয়ে মিলিয়ে)।
4. **Advanced formula**: IFERROR, LET, FILTER, conditional formatting দিয়ে missing worker, দ্বিগুণ entry বা অস্বাভাবিক OT লাল করে দেখাবে।
5. **AI Review sheet**: Claude একটি আলাদা "Review" tab-এ সন্দেহজনক জায়গা লিখে দেবে; আপনি final human verify করবেন।

## নিরাপত্তা যাচাই (প্রতিবার)
- Claude-এর বানানো ফর্মুলা Excel-এ যা হিসাব করবে, software-এর হিসাবের সাথে তা মিলিয়ে দেখা হবে। একটিও না মিললে ওই ফর্মুলা বাদ পড়বে, শুধু software-এর মান থাকবে আর আপনাকে সতর্ক করা হবে।
- Claude বন্ধ থাকলে বা কাজ না করলে আগের মতো সাধারণ Excel তৈরি হবে, কাজ থামবে না।

## Settings
- Settings → API Integrations-এ নতুন category "Excel AI (Claude)": model, on/off, key। Key শুধু server-এ থাকবে।
- OCR-এ Claude আগের মতো বন্ধই থাকবে, শুধু Excel কাজে ব্যবহার হবে।

## আপনার কাজ
- Claude API key Settings-এ বসাবেন (chat-এ দেবেন না)।
- কোন model নেবেন জানাবেন (যেমন Claude Opus / Sonnet)।

## Technical details
- New provider category `excel_ai` in api_integrations; server route calls Anthropic Messages API with a JSON "formula plan" schema (sheet, cell, formula, purpose).
- Formula plan applied to the ExcelJS workbook after the deterministic fill; validated with a formula evaluator against computed values before export.
- Tests: formula plan rejected on mismatch; wage values never overwritten.
