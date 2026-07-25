export function isOwner(projectOwnerAddress: string, connectedAddress?: string | null): boolean {
  if (!connectedAddress) {
    return false;
  }

  return projectOwnerAddress.toLowerCase() === connectedAddress.toLowerCase();
}

/**
 * Normalizes a Stellar address for comparison: collapses/trims surrounding
 * whitespace and uppercases it, since valid StrKey addresses are case-sensitive
 * uppercase but users may paste values with stray whitespace or wrong casing.
 */
export function normalizeStellarAddress(address: string): string {
  return address.trim().toUpperCase();
}

export interface CollaboratorAddressEntry {
  id: string;
  address: string;
}

/**
 * Returns the ids of every collaborator entry whose address (after
 * normalization) is shared with at least one other entry. Empty addresses
 * are ignored - required-field validation handles those separately.
 */
export function findDuplicateCollaboratorAddressIds(
  entries: CollaboratorAddressEntry[],
): Set<string> {
  const firstIdByAddress = new Map<string, string>();
  const duplicateIds = new Set<string>();

  for (const entry of entries) {
    const normalized = normalizeStellarAddress(entry.address);
    if (!normalized) continue;

    const firstId = firstIdByAddress.get(normalized);
    if (firstId !== undefined) {
      duplicateIds.add(firstId);
      duplicateIds.add(entry.id);
    } else {
      firstIdByAddress.set(normalized, entry.id);
    }
  }

  return duplicateIds;
}
