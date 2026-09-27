export interface RuntimeBenchmarkMetrics {
  macroF1: number
  autoPublishedPrecision: number
  evidenceTraceability: number
  crossDistrictMetadataLeaks: number
  peakRssBytes: number
  repeatCostOrLatencyReduction: number
  materiallyBetterRecovery: boolean
}

export interface RuntimeSelection {
  selected: 'node' | 'python' | null
  reason: string
}

export interface LabeledTopicDocument {
  id: string
  goldTopicIds: string[]
  predictions: Array<{
    topicId: string
    confidence: number
    evidenceTraceable: boolean
  }>
  goldSuggestionSlugs?: string[]
  predictedSuggestionSlugs?: string[]
}

export interface TopicQualityMetrics {
  macroF1: number
  microF1: number
  microPrecision: number
  microRecall: number
  autoPublishedPrecision: number
  evidenceTraceability: number
  suggestionPrecision: number | null
  perTopic: Record<string, {
    precision: number
    recall: number
    f1: number
    truePositives: number
    falsePositives: number
    falseNegatives: number
  }>
}

const ONE_GIB = 1024 * 1024 * 1024

function ratio(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : numerator / denominator
}

function f1(precision: number, recall: number) {
  return precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall)
}

export function evaluateTopicQuality(
  documents: LabeledTopicDocument[],
  autoPublishThreshold: number
): TopicQualityMetrics {
  const topicIds = new Set<string>()
  for (const document of documents) {
    document.goldTopicIds.forEach((topicId) => topicIds.add(topicId))
    document.predictions.forEach((prediction) => topicIds.add(prediction.topicId))
  }

  const perTopic: TopicQualityMetrics['perTopic'] = {}
  let totalTruePositives = 0
  let totalFalsePositives = 0
  let totalFalseNegatives = 0
  let traceablePredictions = 0
  let predictionCount = 0
  let publishedTruePositives = 0
  let publishedCount = 0

  for (const document of documents) {
    const gold = new Set(document.goldTopicIds)
    const predictions = new Map(
      document.predictions.map((prediction) => [prediction.topicId, prediction])
    )
    for (const prediction of predictions.values()) {
      predictionCount++
      if (prediction.evidenceTraceable) traceablePredictions++
      if (prediction.confidence >= autoPublishThreshold) {
        publishedCount++
        if (gold.has(prediction.topicId)) publishedTruePositives++
      }
    }
  }

  for (const topicId of topicIds) {
    let truePositives = 0
    let falsePositives = 0
    let falseNegatives = 0
    for (const document of documents) {
      const gold = document.goldTopicIds.includes(topicId)
      const predicted = document.predictions.some((prediction) => prediction.topicId === topicId)
      if (gold && predicted) truePositives++
      else if (predicted) falsePositives++
      else if (gold) falseNegatives++
    }
    const precision = ratio(truePositives, truePositives + falsePositives)
    const recall = ratio(truePositives, truePositives + falseNegatives)
    perTopic[topicId] = {
      precision,
      recall,
      f1: f1(precision, recall),
      truePositives,
      falsePositives,
      falseNegatives,
    }
    totalTruePositives += truePositives
    totalFalsePositives += falsePositives
    totalFalseNegatives += falseNegatives
  }

  const microPrecision = ratio(totalTruePositives, totalTruePositives + totalFalsePositives)
  const microRecall = ratio(totalTruePositives, totalTruePositives + totalFalseNegatives)
  const topicScores = Object.values(perTopic)
  const suggested = documents.flatMap((document) =>
    [...new Set(document.predictedSuggestionSlugs ?? [])].map((slug) => ({
      slug,
      gold: new Set(document.goldSuggestionSlugs ?? []),
    }))
  )

  return {
    macroF1: topicScores.length === 0
      ? 0
      : topicScores.reduce((sum, topic) => sum + topic.f1, 0) / topicScores.length,
    microF1: f1(microPrecision, microRecall),
    microPrecision,
    microRecall,
    autoPublishedPrecision: ratio(publishedTruePositives, publishedCount),
    evidenceTraceability: ratio(traceablePredictions, predictionCount),
    suggestionPrecision: suggested.length === 0
      ? null
      : suggested.filter((suggestion) => suggestion.gold.has(suggestion.slug)).length / suggested.length,
    perTopic,
  }
}

function passesQualityGates(metrics: RuntimeBenchmarkMetrics) {
  return (
    metrics.macroF1 >= 0.85 &&
    metrics.autoPublishedPrecision >= 0.9 &&
    metrics.evidenceTraceability === 1 &&
    metrics.crossDistrictMetadataLeaks === 0
  )
}

export function selectTopicRuntime(
  node: RuntimeBenchmarkMetrics,
  python: RuntimeBenchmarkMetrics
): RuntimeSelection {
  const nodePasses = passesQualityGates(node)
  const pythonPasses = passesQualityGates(python) && python.peakRssBytes <= ONE_GIB

  if (!nodePasses && !pythonPasses) {
    return { selected: null, reason: 'Neither runtime passes quality and isolation gates' }
  }
  if (nodePasses && !pythonPasses) {
    return { selected: 'node', reason: 'Only Node passes required gates' }
  }
  if (!nodePasses && pythonPasses) {
    return { selected: 'python', reason: 'Only Python passes required gates' }
  }

  const macroF1Difference = python.macroF1 - node.macroF1
  if (
    macroF1Difference >= 0.05 ||
    python.repeatCostOrLatencyReduction >= 0.3 ||
    python.materiallyBetterRecovery
  ) {
    return { selected: 'python', reason: 'Python clears an explicit selection advantage' }
  }
  if (Math.abs(macroF1Difference) <= 0.02) {
    return { selected: 'node', reason: 'Accuracy is within two points; defaulting to Node' }
  }
  return { selected: 'node', reason: 'Python does not clear an explicit selection advantage' }
}
