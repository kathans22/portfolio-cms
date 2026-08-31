import { CertificationAttrs } from './certification.model';

// Structural rather than tied to CertificationDoc: this reads plain fields and computes
// isExpired itself, so it works for anything carrying the attributes — a hydrated
// document, a lean result, or an aggregation row.
type CertificationSource = CertificationAttrs & { id: unknown };

// Explicit allowlist, not a blocklist. Returning whole documents means every field
// added to the model later is published by default; this way a new field stays private
// until someone deliberately adds it here.
//
// Deliberately excluded:
//   status, showWhenExpired, order  — admin-only editorial controls
//   expiresSoon                     — renewal signal for the admin dashboard only
//   createdAt, updatedAt            — internal bookkeeping
export interface PublicCertificationPayload {
  id: string;
  name: string;
  issuingOrganization: string;
  issuerLogoUrl?: string;
  issueDate: Date;
  expiryDate: Date | null;
  neverExpires: boolean;
  isExpired: boolean;
  credentialId?: string;
  credentialUrl?: string;
  certificateImageUrl?: string;
  description?: string;
  skillIds: string[];
  domains: string[];
}

export function toPublicCertification(cert: CertificationSource): PublicCertificationPayload {
  const expiryDate = cert.expiryDate ?? null;
  return {
    id: String(cert.id),
    name: cert.name,
    issuingOrganization: cert.issuingOrganization,
    issuerLogoUrl: cert.issuerLogoUrl,
    issueDate: cert.issueDate,
    expiryDate,
    neverExpires: cert.neverExpires,
    // Computed here rather than read off the virtual, so this stays a plain object and
    // behaves identically whether it came from a query or an aggregation.
    isExpired: !cert.neverExpires && !!expiryDate && expiryDate.getTime() < Date.now(),
    credentialId: cert.credentialId,
    credentialUrl: cert.credentialUrl,
    certificateImageUrl: cert.certificateImageUrl,
    description: cert.description,
    skillIds: cert.skillIds.map(String),
    domains: cert.domains,
  };
}
