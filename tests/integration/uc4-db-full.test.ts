import 'dotenv/config'

import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { prisma } from '@/shared/infra/prisma/client'

import { CHECKS, FINDINGS, SECTIONS, renderTable, summarize, totals } from './uc4-db-checks'
import type { CheckContext } from './uc4-db-checks'
import {
  CLOCK_MODE,
  FIXED_NOW,
  WINDOW,
  cleanupData,
  countOurRows,
  seedData,
} from './uc4-db-fixtures'
import type { SeedData } from './uc4-db-fixtures'

const OUTPUT = path.join(process.cwd(), 'docs', 'test-results', 'uc4-db-integration.txt')
const startedAt = Date.now()
const logs: string[] = []
const reports: string[] = []
const results = new Map<string, 'pass' | 'fail'>()

function log(line: string): void {
  logs.push(line)
  console.log(line)
}

const enabled = process.env.DATABASE_URL !== undefined && process.env.DATABASE_URL !== ''

describe.skipIf(!enabled)('UC4 — Full End-to-End DB Integration', () => {
  let seed: SeedData | undefined
  let rowsBeforeCleanup = 0
  let rowsAfterCleanup = 0
  let cleanupFailures: string[] = []

  const ctx: CheckContext = {
    seed: undefined as unknown as SeedData,
    expect,
    log,
    reports,
  }

  beforeAll(async () => {
    log('='.repeat(72))
    log('UC4 FULL END-TO-END DB INTEGRATION — SETUP')
    log(`clock mode : ${CLOCK_MODE} (FIXED_NOW = ${FIXED_NOW.toISOString()})`)
    log(`window     : ${WINDOW.from} .. ${WINDOW.to} (district Kegalle, hazard FLOOD)`)
    log(`started    : ${new Date().toISOString()}`)
    log('='.repeat(72))
    await prisma.$connect()
    seed = await seedData()
    ctx.seed = seed
    const counts = await countOurRows(seed)
    log(
      `seeded ${counts.total} rows: alerts=${counts.alerts} attempts=${counts.attempts} ` +
        `groundReports=${counts.groundReports} auditEntries=${counts.auditEntries} ` +
        `occupancyEvents=${counts.occupancyEvents} distributions=${counts.distributions}`,
    )
  }, 180_000)

  for (const section of SECTIONS) {
    const sectionChecks = CHECKS.filter((check) => check.section === section.key)
    describe(section.title, () => {
      beforeAll(() => {
        log('')
        log(`── ${section.title} (${sectionChecks.length} checks)`)
      })
      for (const check of sectionChecks) {
        it(
          `${check.id}: ${check.title}`,
          async () => {
            try {
              await check.run(ctx)
              results.set(check.id, 'pass')
            } catch (error) {
              results.set(check.id, 'fail')
              throw error
            }
          },
          60_000,
        )
      }
    })
  }

  afterAll(async () => {
    const durationMs = Date.now() - startedAt

    if (seed !== undefined) {
      const beforeCounts = await countOurRows(seed)
      rowsBeforeCleanup = beforeCounts.total
      cleanupFailures = await cleanupData(seed)
      const afterCounts = await countOurRows(seed)
      rowsAfterCleanup = afterCounts.total
    }

    log('')
    log(`rows created ${rowsBeforeCleanup}, rows remaining after cleanup ${rowsAfterCleanup}`)
    if (cleanupFailures.length > 0) {
      log(`CLEANUP FAILURES (${cleanupFailures.length}): ${cleanupFailures.join(' | ')}`)
    } else {
      log('cleanup: every suite row removed')
    }

    const rows = summarize(CHECKS, results)
    const summary = totals(rows)
    log('')
    log(renderTable(rows))
    log('')
    log('FINDINGS / DEVIATIONS:')
    FINDINGS.forEach((finding, index) => log(`  ${index + 1}. ${finding}`))
    log('')
    log(`duration: ${(durationMs / 1000).toFixed(1)}s`)

    const report = [
      'UC4 Full End-to-End DB Integration Test',
      '========================================',
      `generated : ${new Date().toISOString()}`,
      `duration  : ${(durationMs / 1000).toFixed(1)}s`,
      `clock     : ${CLOCK_MODE} (FIXED_NOW = ${FIXED_NOW.toISOString()})`,
      `window    : ${WINDOW.from} .. ${WINDOW.to} (district Kegalle, hazard FLOOD)`,
      'database  : PostgreSQL via Prisma (DATABASE_URL configured, value not shown)',
      '',
      `checks    : ${summary.total} total, ${summary.pass} passed, ${summary.fail} failed, ${summary.skip} skipped`,
      '',
      renderTable(rows),
      '',
      `rows created by suite : ${rowsBeforeCleanup}`,
      `rows after cleanup    : ${rowsAfterCleanup}`,
      `cleanup failures      : ${
        cleanupFailures.length === 0 ? 'none' : cleanupFailures.join(' | ')
      }`,
      '',
      'FINDINGS / DEVIATIONS:',
      ...FINDINGS.map((finding, index) => `  ${index + 1}. ${finding}`),
      '',
      'LOG TRANSCRIPT:',
      ...logs,
      '',
    ].join('\n')

    mkdirSync(path.dirname(OUTPUT), { recursive: true })
    writeFileSync(OUTPUT, report, 'utf8')
    console.log(`report written to ${OUTPUT}`)

    await prisma.$disconnect()
  }, 180_000)
})
