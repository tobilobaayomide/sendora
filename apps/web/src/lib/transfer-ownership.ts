const ownershipChanged = "sendora:ownership-changed";

function storageKey(slug: string) {
  return `sendora:owner-token:${slug}`;
}

export function getOwnerToken(slug: string): string | null {
  try {
    return window.localStorage.getItem(storageKey(slug)) || null;
  } catch {
    return null;
  }
}

export function storeOwnerToken(slug: string, ownerToken: string): boolean {
  try {
    window.localStorage.setItem(storageKey(slug), ownerToken);
    window.dispatchEvent(new Event(ownershipChanged));
    return true;
  } catch {
    return false;
  }
}

export function removeOwnerToken(slug: string): boolean {
  try {
    window.localStorage.removeItem(storageKey(slug));
    window.dispatchEvent(new Event(ownershipChanged));
    return true;
  } catch {
    return false;
  }
}

export function subscribeToOwnership(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(ownershipChanged, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(ownershipChanged, onChange);
  };
}
