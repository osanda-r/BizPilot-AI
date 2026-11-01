import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'

// Run against the dev servers. For CI, install Chromium with `npx playwright install chromium`.
// Set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH to use an existing Chromium binary instead.
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:5173'
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
})
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await context.newPage()
const runtimeErrors = []
const savedIds = new Set()
const orderReference = `SMOKE-${Date.now()}`
page.on('pageerror', (error) => runtimeErrors.push(error.message))
page.on('response', (response) => {
  if (response.url().endsWith('/api/tasks') && response.request().method() === 'POST' && response.ok()) {
    response
      .json()
      .then((body) => body.tasks?.forEach((task) => savedIds.add(task.id)))
      .catch(() => {})
  }
})

async function audit(name) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  const violations = result.violations.map((item) => ({
    id: item.id,
    nodes: item.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
  }))
  assert.deepEqual(violations, [], `${name} accessibility violations: ${JSON.stringify(violations, null, 2)}`)
}

async function navigate(label) {
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: label }).click()
}

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Local mode', exact: true }).waitFor()
  assert.match(await page.title(), /BizPilot/)
  await audit('Overview')
  if (process.env.SCREENSHOT_DIR) {
    await mkdir(process.env.SCREENSHOT_DIR, { recursive: true })
    await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/overview.png`, fullPage: true })
  }

  await navigate('Customer inbox')
  assert.equal(await page.getByRole('button', { name: 'Analyze message', exact: true }).isDisabled(), true)
  await page.getByRole('button', { name: 'Try an example' }).click()
  await page.getByRole('button', { name: 'Analyze message', exact: true }).click()
  await page.getByRole('button', { name: 'Draft a reply', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Draft a reply', exact: true }).click()
  const draft = page.getByLabel('Editable reply draft')
  await draft.waitFor()
  assert.match(await draft.inputValue(), /Hello/)
  await draft.fill('Edited reply: please confirm your order reference.')
  await page.getByRole('button', { name: 'Save follow-up as a task' }).click()
  await page.getByRole('button', { name: 'Follow-up task saved' }).waitFor()
  await audit('Customer inbox')

  await navigate('Order to tasks')
  await page
    .getByLabel('Order message', { exact: true })
    .fill(`Order reference: ${orderReference}\nCustomer: Smoke Test\n2 x Ceramic mug\n1 x Gift wrapping`)
  await page.getByRole('button', { name: 'Extract order tasks' }).click()
  await page.getByText('Smoke Test', { exact: true }).waitFor()
  assert.equal(await page.getByRole('checkbox').count(), 3)
  await page.getByRole('checkbox', { name: 'Select task 3' }).uncheck()
  await page.getByRole('button', { name: 'Save 2 selected tasks' }).click()
  await page.getByRole('button', { name: 'Tasks saved' }).waitFor()
  await audit('Order extraction')

  await navigate('My tasks')
  await page.getByRole('heading', { name: `Review and confirm order ${orderReference}` }).waitFor()
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: `Review and confirm order ${orderReference}` }).waitFor()
  await page.getByLabel(`Status of Review and confirm order ${orderReference}`).selectOption('in_progress')
  await page.getByText('Task status updated.', { exact: true }).waitFor()
  await page.getByRole('button', { name: /In progress/ }).click()
  await page.getByRole('heading', { name: `Review and confirm order ${orderReference}` }).waitFor()
  await audit('Task list')
  await page.getByRole('button', { name: /All tasks/ }).click()
  await page.getByRole('button', { name: `Delete Review and confirm order ${orderReference}` }).click()
  await page.getByRole('button', { name: 'Delete task', exact: true }).click()
  await page
    .getByRole('heading', { name: `Review and confirm order ${orderReference}` })
    .waitFor({ state: 'hidden' })

  await navigate('AI assistant')
  assert.equal(await page.getByLabel('Message BizPilot').isDisabled(), true)
  await audit('AI assistant')
  await page.getByRole('button', { name: 'Setup & help' }).click()
  await page.getByRole('dialog').waitFor()
  await audit('Setup dialog')
  await page.keyboard.press('Escape')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('button', { name: 'Overview', exact: true }).click()
  await page.getByRole('heading', { name: 'Good things start with a clear day.' }).waitFor()
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
    'Mobile horizontal overflow',
  )
  await audit('Mobile overview')
  if (process.env.SCREENSHOT_DIR)
    await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/mobile.png`, fullPage: true })
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('button', { name: 'Order to tasks', exact: true }).click()
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
    'Mobile order page overflow',
  )
  await audit('Mobile orders')
  assert.deepEqual(runtimeErrors, [], 'Browser runtime errors')
  console.log(
    'PASS: live API, message classification, editable drafts, order tasks, persistence, status, deletion, mobile navigation, and accessibility audits.',
  )
} finally {
  // Clean up only records created by this smoke run.
  for (const id of savedIds) await context.request.delete(`${baseURL}/api/tasks/${id}`).catch(() => {})
  await browser.close()
}
