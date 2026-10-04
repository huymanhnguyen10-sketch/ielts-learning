/** True when the text contains Vietnamese letters (diacritics or đ). */
const VI_CHARS = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

export function hasVietnamese(text: string | null | undefined): boolean {
  return !!text && VI_CHARS.test(text);
}

/** Message shown when no ANTHROPIC_API_KEY is configured. */
export const VI_OFFLINE_MESSAGE =
  "Add ANTHROPIC_API_KEY to .env to translate and explain phrases in Vietnamese.";
