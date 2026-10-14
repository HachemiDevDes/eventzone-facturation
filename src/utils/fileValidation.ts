export const MAX_LOGO_SIZE_BYTES = 1.5 * 1024 * 1024; // 1.5 MB
export const MAX_ATTACHMENT_SIZE_BYTES = 3 * 1024 * 1024; // 3 MB

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export const validateImageFile = (file: File, maxSize = MAX_LOGO_SIZE_BYTES): FileValidationResult => {
  if (!file) return { valid: false, error: 'Aucun fichier sélectionné' };

  if (file.size > maxSize) {
    const maxMb = (maxSize / (1024 * 1024)).toFixed(1);
    return { valid: false, error: `Le fichier est trop volumineux (maximum ${maxMb} Mo).` };
  }

  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Format non supporté. Veuillez choisir une image PNG, JPG, WEBP ou SVG.' };
  }

  return { valid: true };
};

export const validateAttachmentFile = (file: File, maxSize = MAX_ATTACHMENT_SIZE_BYTES): FileValidationResult => {
  if (!file) return { valid: false, error: 'Aucun fichier sélectionné' };

  if (file.size > maxSize) {
    const maxMb = (maxSize / (1024 * 1024)).toFixed(1);
    return { valid: false, error: `Le document est trop volumineux (maximum ${maxMb} Mo).` };
  }

  const allowedTypes = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
  ];
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Format non supporté. Veuillez choisir un fichier PDF, PNG ou JPG.' };
  }

  return { valid: true };
};

export const isSafeSvg = (svgText: string): boolean => {
  const lower = svgText.toLowerCase();
  const dangerousPatterns = ['<script', 'javascript:', 'onload=', 'onerror=', 'onclick=', '<iframe', '<object'];
  return !dangerousPatterns.some(pattern => lower.includes(pattern));
};
