export function createEmptyUploadDirectoryDrafts() {
  return {
    'single-image': '',
    'single-design': '',
    'series-design': '',
    'series-generate': ''
  }
}

export function normalizeUploadDirectoryDrafts(uploadDirectories = {}) {
  return {
    ...createEmptyUploadDirectoryDrafts(),
    ...(uploadDirectories || {})
  }
}

export function createImageAsset(file, idPrefix, preview = true) {
  const previewValue = typeof file.preview === 'string' ? file.preview : ''
  return {
    id: `${idPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    path: file.path || '',
    sizeLabel: `${Math.max(1, Math.round((Number(file.size) || 0) / 1024))} KB`,
    preview: preview
      ? (previewValue || (file instanceof File ? URL.createObjectURL(file) : ''))
      : '',
    storedPath: ''
  }
}

export function revokePreview(preview) {
  if (preview && preview.startsWith('blob:')) {
    URL.revokeObjectURL(preview)
  }
}

export function revokeDraftPreviews(draft = {}) {
  const imageAssignments = draft.imageAssignments || []

  imageAssignments.forEach((item) => revokePreview(item.preview))
  revokePreview(draft.sourceImage?.preview)
}
