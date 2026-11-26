/** A local preview cannot open the production SMTP socket transport. */
export class SmtpRuntimeUnavailableError extends Error {
  constructor() {
    super("SMTP sending is unavailable in this local preview. Publish these changes, then test Hostinger from Settings → SMTP on hrbsm.xyz. Your saved mail settings have not been changed.");
    this.name = "SmtpRuntimeUnavailableError";
  }
}

export async function loadSmtpTransport<T>(localPreview: boolean, load: () => Promise<T>): Promise<T> {
  if (localPreview) throw new SmtpRuntimeUnavailableError();
  return load();
}