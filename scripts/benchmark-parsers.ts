import { readFile, writeFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { LiteParse } from '@llamaindex/liteparse'
import { PDFParse } from 'pdf-parse'
import { downloadBoardDocsPdf, isAllowedBoardDocsPdfUrl } from '@/lib/boarddocs'
import { normalizePdfPages } from '@/lib/document-preprocessing'

interface ManifestDocument {
  id: string
  sourceUrl: string
  visibleFacts: string[]
  humanScores: Record<string, number | null>
}

async function main() {
  const manifestPath = process.argv[2] ?? 'benchmark/boarddocs-attachments.json'
  const outputPath = process.argv[3] ?? 'benchmark/parser-report.json'
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
    documentCount: number
    meetingCount: number
    documents: ManifestDocument[]
  }

  if (manifest.documentCount < 80 || manifest.meetingCount < 20) {
    throw new Error('Frozen manifest does not meet 80-document/20-meeting gate')
  }

  const liteParse = new LiteParse({
    outputFormat: 'markdown',
    ocrEnabled: true,
    maxPages: 200,
    imageMode: 'placeholder',
    keepHeadersFooters: false,
    numWorkers: 2,
    quiet: true,
  })
  const results: unknown[] = []
  const failures = { download: 0, pdfParse: 0, liteParse: 0 }

  for (const document of manifest.documents) {
    if (!isAllowedBoardDocsPdfUrl(document.sourceUrl))
      throw new Error(`Unsafe URL in manifest: ${document.id}`)
    let download: Awaited<ReturnType<typeof downloadBoardDocsPdf>>
    try {
      download = await downloadBoardDocsPdf(document.sourceUrl)
    } catch (error) {
      failures.download++
      results.push({
        id: document.id,
        downloadError: error instanceof Error ? error.message : 'Download failed',
        humanScores: document.humanScores,
      })
      continue
    }
    const { buffer, byteSize } = download
    const baseline = await measure(async () => {
      const parser = new PDFParse({ data: new Uint8Array(buffer) })
      try {
        const text = await parser.getText({ pageJoiner: '' })
        return {
          markdown: normalizePdfPages(
            text.pages.map((page) => ({ page: page.num, text: page.text })),
          ),
          pageCount: text.total,
        }
      } finally {
        await parser.destroy()
      }
    })
    const candidate = await measure(async () => {
      const parsed = await liteParse.parse(buffer)
      return { markdown: parsed.text, pageCount: parsed.pages.length }
    })
    if (!baseline.ok) failures.pdfParse++
    if (!candidate.ok) failures.liteParse++

    results.push({
      id: document.id,
      byteSize,
      pdfParse: outcomeMetrics(baseline, document.visibleFacts),
      liteParse: outcomeMetrics(candidate, document.visibleFacts),
      humanScores: document.humanScores,
    })
  }

  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        manifestPath,
        documentCount: manifest.documentCount,
        failures,
        failureRates: {
          download: failures.download / manifest.documentCount,
          pdfParse: failures.pdfParse / manifest.documentCount,
          liteParse: failures.liteParse / manifest.documentCount,
        },
        results,
      },
      null,
      2,
    )}\n`,
  )
  console.log(`Wrote parser benchmark report to ${outputPath}`)

  async function measure<T>(operation: () => Promise<T>) {
    const startRss = process.memoryUsage().rss
    const start = performance.now()
    try {
      return {
        ok: true as const,
        value: await operation(),
        elapsedMs: performance.now() - start,
        peakRssBytes: Math.max(startRss, process.memoryUsage().rss),
      }
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : 'Parser failed',
        elapsedMs: performance.now() - start,
        peakRssBytes: Math.max(startRss, process.memoryUsage().rss),
      }
    }
  }

  function outcomeMetrics(
    outcome: Awaited<ReturnType<typeof measure<{ markdown: string; pageCount: number }>>>,
    facts: string[],
  ) {
    if (!outcome.ok) return { success: false, ...outcome }
    return {
      success: true,
      ...metrics(
        outcome.value.markdown,
        outcome.value.pageCount,
        outcome.elapsedMs,
        outcome.peakRssBytes,
        facts,
      ),
    }
  }

  function metrics(
    markdown: string,
    pageCount: number,
    elapsedMs: number,
    peakRssBytes: number,
    facts: string[],
  ) {
    const nonWhitespace = markdown.replace(/\s/g, '').length
    return {
      nonEmpty: nonWhitespace > 0,
      characterCount: markdown.length,
      pageCount,
      tableRowCount: (markdown.match(/^\|.*\|$/gm) ?? []).length,
      replacementCharacterCount: (markdown.match(/�/g) ?? []).length,
      visibleFactRecovery:
        facts.length === 0
          ? null
          : facts.filter((fact) => markdown.includes(fact)).length / facts.length,
      elapsedMs,
      peakRssBytes,
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
