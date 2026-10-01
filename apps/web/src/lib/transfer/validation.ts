export type TransferSettingsError = {
  field: "expiry" | "downloads";
  message: string;
};

export function validateTransferSettings(
  expiryValue: string,
  downloadsValue: string,
):
  | {
      expiresInHours: number;
      maxDownloads: number;
    }
  | TransferSettingsError {
  const expiresInHours = Number(expiryValue);
  if (
    !Number.isInteger(expiresInHours) ||
    expiresInHours < 1 ||
    expiresInHours > 168
  ) {
    return {
      field: "expiry",
      message: "Choose a whole number from 1 to 168 hours.",
    };
  }

  const maxDownloads = Number(downloadsValue);
  if (
    !Number.isInteger(maxDownloads) ||
    maxDownloads < 1 ||
    maxDownloads > 100
  ) {
    return {
      field: "downloads",
      message: "Choose a whole number from 1 to 100 downloads.",
    };
  }

  return { expiresInHours, maxDownloads };
}
