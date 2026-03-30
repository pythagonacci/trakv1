type UserMetadataLike = {
  first_name?: unknown;
  last_name?: unknown;
  name?: unknown;
  full_name?: unknown;
  display_name?: unknown;
} | null | undefined;

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getEmailLocalPart(email?: string | null): string | null {
  const trimmedEmail = asTrimmedString(email);
  if (!trimmedEmail) return null;

  const [localPart] = trimmedEmail.split("@");
  return asTrimmedString(localPart);
}

function getMetadataFullName(userMetadata?: UserMetadataLike): string | null {
  const firstName = asTrimmedString(userMetadata?.first_name);
  const lastName = asTrimmedString(userMetadata?.last_name);

  if (firstName && lastName) return `${firstName} ${lastName}`;
  return firstName || lastName || null;
}

function getFirstToken(value?: string | null): string | null {
  const trimmed = asTrimmedString(value);
  if (!trimmed) return null;

  const [firstToken] = trimmed.split(/\s+/);
  return asTrimmedString(firstToken);
}

export function resolveUserDisplayName(options: {
  profileName?: string | null;
  userMetadata?: UserMetadataLike;
  email?: string | null;
  fallback?: string;
}): string {
  const { profileName, userMetadata, email, fallback = "User" } = options;

  return (
    asTrimmedString(profileName) ||
    getMetadataFullName(userMetadata) ||
    asTrimmedString(userMetadata?.full_name) ||
    asTrimmedString(userMetadata?.name) ||
    asTrimmedString(userMetadata?.display_name) ||
    getEmailLocalPart(email) ||
    fallback
  );
}

export function resolveUserFirstName(options: {
  profileName?: string | null;
  userMetadata?: UserMetadataLike;
  email?: string | null;
  fallback?: string;
}): string {
  const { profileName, userMetadata, email, fallback = "User" } = options;

  return (
    asTrimmedString(userMetadata?.first_name) ||
    getFirstToken(profileName) ||
    getFirstToken(getMetadataFullName(userMetadata)) ||
    getFirstToken(asTrimmedString(userMetadata?.full_name)) ||
    getFirstToken(asTrimmedString(userMetadata?.name)) ||
    getEmailLocalPart(email) ||
    fallback
  );
}
