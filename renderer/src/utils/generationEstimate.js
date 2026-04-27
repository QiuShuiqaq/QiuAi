export const CURRENT_MODEL_NAME = 'gpt-image-2'
export const CURRENT_MODEL_CREDITS_PER_IMAGE = 600
export const CURRENT_MODEL_PRICE_MIN = 0.03
export const CURRENT_MODEL_PRICE_MAX = 0.06
export const DEFAULT_DETAIL_PRESET_COUNT = 4

function normalizeImageCount ({ mode, styleSourceFiles = [], detailPresetCount = DEFAULT_DETAIL_PRESET_COUNT }) {
  if (mode === 'style-batch') {
    return styleSourceFiles.length
  }

  if (mode === 'detail-set') {
    return detailPresetCount
  }

  return 1
}

function formatPriceValue(value) {
  return value.toFixed(2).replace(/\.?0+$/, '')
}

export function calculateGenerationEstimate ({
  mode = 'single',
  styleSourceFiles = [],
  detailPresetCount = DEFAULT_DETAIL_PRESET_COUNT
} = {}) {
  const imageCount = normalizeImageCount({
    mode,
    styleSourceFiles,
    detailPresetCount
  })
  const totalCredits = imageCount * CURRENT_MODEL_CREDITS_PER_IMAGE
  const priceMin = imageCount * CURRENT_MODEL_PRICE_MIN
  const priceMax = imageCount * CURRENT_MODEL_PRICE_MAX

  return {
    imageCount,
    creditsPerImage: CURRENT_MODEL_CREDITS_PER_IMAGE,
    totalCredits,
    priceMin,
    priceMax,
    formattedPriceRange: `¥${formatPriceValue(priceMin)} ~ ¥${formatPriceValue(priceMax)}`,
    formattedCreditsPerImage: `${CURRENT_MODEL_CREDITS_PER_IMAGE} 积分 / 次`
  }
}
