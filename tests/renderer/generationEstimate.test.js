import { describe, expect, it } from 'vitest'

describe('generation estimate', () => {
  it('calculates single mode estimates for gpt-image-2', async () => {
    const { calculateGenerationEstimate } = await import('../../renderer/src/utils/generationEstimate.js')

    expect(calculateGenerationEstimate({
      mode: 'single',
      styleSourceFiles: [],
      detailPresetCount: 4
    })).toEqual({
      imageCount: 1,
      creditsPerImage: 600,
      totalCredits: 600,
      priceMin: 0.03,
      priceMax: 0.06,
      formattedPriceRange: '¥0.03 ~ ¥0.06',
      formattedCreditsPerImage: '600 积分 / 次'
    })
  })

  it('calculates style batch estimates from local file count', async () => {
    const { calculateGenerationEstimate } = await import('../../renderer/src/utils/generationEstimate.js')

    const estimate = calculateGenerationEstimate({
      mode: 'style-batch',
      styleSourceFiles: ['a.png', 'b.png', 'c.png'],
      detailPresetCount: 4
    })

    expect(estimate.imageCount).toBe(3)
    expect(estimate.totalCredits).toBe(1800)
    expect(estimate.formattedPriceRange).toBe('¥0.09 ~ ¥0.18')
  })

  it('uses detail preset count for detail-set mode', async () => {
    const { calculateGenerationEstimate } = await import('../../renderer/src/utils/generationEstimate.js')

    const estimate = calculateGenerationEstimate({
      mode: 'detail-set',
      styleSourceFiles: [],
      detailPresetCount: 4
    })

    expect(estimate.imageCount).toBe(4)
    expect(estimate.totalCredits).toBe(2400)
    expect(estimate.formattedPriceRange).toBe('¥0.12 ~ ¥0.24')
  })
})
