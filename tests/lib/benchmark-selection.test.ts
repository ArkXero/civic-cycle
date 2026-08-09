import { describe, expect, it } from 'vite-plus/test'
import {
  evaluateTopicQuality,
  selectTopicRuntime,
  type RuntimeBenchmarkMetrics,
} from '@/lib/benchmark-selection'

const passing: RuntimeBenchmarkMetrics = {
  macroF1: 0.88,
  autoPublishedPrecision: 0.92,
  evidenceTraceability: 1,
  crossDistrictMetadataLeaks: 0,
  peakRssBytes: 400_000_000,
  repeatCostOrLatencyReduction: 0,
  materiallyBetterRecovery: false,
}

describe('topic runtime selection', () => {
  it('calculates multilabel quality, evidence, and suggestion metrics', () => {
    const metrics = evaluateTopicQuality([
      {
        id: 'one',
        goldTopicIds: ['budget'],
        predictions: [
          { topicId: 'budget', confidence: 0.96, evidenceTraceable: true },
          { topicId: 'safety', confidence: 0.7, evidenceTraceable: false },
        ],
        goldSuggestionSlugs: ['facilities'],
        predictedSuggestionSlugs: ['facilities'],
      },
      {
        id: 'two',
        goldTopicIds: ['safety'],
        predictions: [{ topicId: 'safety', confidence: 0.97, evidenceTraceable: true }],
      },
    ], 0.95)

    expect(metrics.microPrecision).toBeCloseTo(2 / 3)
    expect(metrics.microRecall).toBe(1)
    expect(metrics.autoPublishedPrecision).toBe(1)
    expect(metrics.evidenceTraceability).toBeCloseTo(2 / 3)
    expect(metrics.suggestionPrecision).toBe(1)
    expect(metrics.perTopic.budget.f1).toBe(1)
    expect(metrics.perTopic.safety.precision).toBe(0.5)
  })

  it('defaults to Node when accuracy is within two points', () => {
    expect(selectTopicRuntime(passing, { ...passing, macroF1: 0.9 }).selected).toBe('node')
  })

  it('selects Python when it improves macro-F1 by at least five points', () => {
    expect(selectTopicRuntime(passing, { ...passing, macroF1: 0.94 }).selected).toBe('python')
  })

  it('selects Python when warm repeat processing improves by 30 percent', () => {
    expect(selectTopicRuntime(passing, {
      ...passing,
      repeatCostOrLatencyReduction: 0.3,
    }).selected).toBe('python')
  })

  it('rejects Python above the 1 GB worker limit', () => {
    expect(selectTopicRuntime(passing, {
      ...passing,
      macroF1: 0.96,
      peakRssBytes: 1024 * 1024 * 1024 + 1,
    }).selected).toBe('node')
  })

  it('selects no runtime when both miss required quality gates', () => {
    const failing = { ...passing, evidenceTraceability: 0.99 }
    expect(selectTopicRuntime(failing, failing).selected).toBeNull()
  })
})
