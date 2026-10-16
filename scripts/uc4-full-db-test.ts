import 'dotenv/config'

import { prisma } from '@/shared/infra/prisma/client'

import { CHECKS, FINDINGS, SECTIONS, renderTable, summarize, totals } from '../tests/integration/uc4-db-checks'
import type { CheckContext } from '../tests/integration/uc4-db-checks'
import {
  CLOCK_MODE,
  FIXED_NOW,
  WINDOW,
  cleanupData,
  countOurRows,
  seedData,
} from '../tests/integration/uc4-db-fixtures'
import type { SeedData } from '../tests/integration/uc4-db-fixtures'

function message(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message
  }
  return String(error)
}

function excerpt(error: unknown): string {
  return message(error)
    .split('\n')
    .slice(0, 6)
    .map((line) => `        ${line}`)
    .join('\n')
}

async function main(): Promise<void> {
  if (process.env.DATABASE_URL === undefined || process.env.DATABASE_URL === '') {
    console.error('DATABASE_URL is not set — cannot run the UC4 DB integration script.')
    process.exitCode = 1
    return
  }

  const { expect } = await import('vitest')
  const startedAt = Date.now()
  const reports: string[] = []
  const results = new Map<string, 'pass' | 'fail'>()
  const log = (line: string): void => {
    console.log(line)
  }

  log('='.repeat(72))
  log('UC4 FULL END-TO-END DB INTEGRATION — tsx runner')
  log(`clock mode : ${CLOCK_MODE} (FIXED_NOW = ${FIXED_NOW.toISOString()})`)
  log(`window     : ${WINDOW.from} .. ${WINDOW.to} (district Kegalle, hazard FLOOD)`)
  log(`started    : ${new Date().toISOString()}`)
  log('='.repeat(72))

  await prisma.$connect()
  const seed: SeedData = await seedData()
  const ctx: CheckContext = { seed, expect, log, reports }
  const seeded = await countOurRows(seed)
  log(
    `seeded ${seeded.total} rows: alerts=${seeded.alerts} attempts=${seeded.attempts} ` +
      `groundReports=${seeded.groundReports} auditEntries=${seeded.auditEntries} ` +
      `occupancyEvents=${seeded.occupancyEvents} distributions=${seeded.distributions}`,
  )

  for (const section of SECTIONS) {
    log('')
    log(`── ${section.title}`)
    for (const check of CHECKS.filter((candidate) => candidate.section === section.key)) {
      try {
        await check.run(ctx)
        results.set(check.id, 'pass')
        log(`  PASS ${check.id}: ${check.title}`)
      } catch (error) {
        results.set(check.id, 'fail')
        log(`  FAIL ${check.id}: ${check.title}`)
        log(excerpt(error))
      }
    }
  }

  const rows = summarize(CHECKS, results)
  const summary = totals(rows)
  log('')
  log(renderTable(rows))

  const beforeCleanup = (await countOurRows(seed)).total
  const cleanupFailures = await cleanupData(seed)
  const afterCleanup = (await countOurRows(seed)).total
  log('')
  log(`rows created ${beforeCleanup}, rows remaining after cleanup ${afterCleanup}`)
  if (cleanupFailures.length > 0) {
    log(`CLEANUP FAILURES (${cleanupFailures.length}): ${cleanupFailures.join(' | ')}`)
  } else {
    log('cleanup: every suite row removed')
  }

  log('')
  log('FINDINGS / DEVIATIONS:')
  FINDINGS.forEach((finding, index) => log(`  ${index + 1}. ${finding}`))
  log('')
  log(
    `${summary.pass}/${summary.total} checks passed, ${summary.fail} failed, ${summary.skip} skipped`,
  )
  log(`duration: ${((Date.now() - startedAt) / 1000).toFixed(1)}s`)

  await prisma.$disconnect()

  if (summary.fail > 0 || cleanupFailures.length > 0) {
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  console.error('UC4 DB script failed:', error)
  process.exitCode = 1
})
