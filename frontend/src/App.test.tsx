import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { api } from './api'
import { CLASSIFICATION, EXTRACTION, HEALTH, REPLY, TASK } from './test/fixtures'
import type { Task } from './types'

vi.mock('./api', () => ({
  api: {
    health: vi.fn(),
    tasks: vi.fn(),
    classify: vi.fn(),
    draft: vi.fn(),
    extractOrder: vi.fn(),
    createTasks: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    chat: vi.fn(),
  },
}))

beforeEach(() => {
  window.location.hash = ''
  vi.mocked(api.health).mockResolvedValue(HEALTH)
  vi.mocked(api.tasks).mockResolvedValue([])
  vi.mocked(api.classify).mockResolvedValue(CLASSIFICATION)
  vi.mocked(api.draft).mockResolvedValue(REPLY)
  vi.mocked(api.extractOrder).mockResolvedValue(EXTRACTION)
  vi.mocked(api.createTasks).mockResolvedValue({ tasks: [TASK], created_count: 1, skipped_count: 0 })
  vi.mocked(api.updateTask).mockResolvedValue({ ...TASK, status: 'done' })
  vi.mocked(api.deleteTask).mockResolvedValue(undefined)
  vi.mocked(api.chat).mockResolvedValue({ reply: 'Try asking for the order reference.', engine: 'groq' })
  Object.defineProperty(window, 'scrollTo', { value: vi.fn(), configurable: true })
  Object.defineProperty(Element.prototype, 'scrollIntoView', { value: vi.fn(), configurable: true })
})

async function openPage(name: string) {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name }))
  return user
}

describe('BizPilot workspace', () => {
  it('shows real empty task counts and local mode, not fabricated activity', async () => {
    render(<App />)
    expect(await screen.findByRole('button', { name: 'Local mode' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ready to start: 0. Open tasks' })).toBeInTheDocument()
    expect(screen.getByText('Nothing on your plate. Yet.')).toBeInTheDocument()
    expect(screen.queryByText(/Lesson 01|Soon/)).not.toBeInTheDocument()
  })

  it('classifies, drafts, edits and copies a reply without sending it', async () => {
    render(<App />)
    const user = await openPage('Customer inbox')
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
    expect(screen.getByRole('button', { name: 'Analyze message' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Try an example' }))
    await user.click(screen.getByRole('button', { name: 'Analyze message' }))
    expect(await screen.findByText('A mug arrived broken.')).toBeInTheDocument()
    expect(screen.getAllByText('Local rules').length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Draft a reply' }))
    const draft = await screen.findByLabelText('Editable reply draft')
    expect(draft).toHaveValue(REPLY.draft)
    await user.clear(draft)
    await user.type(draft, 'My edited reply')
    await user.selectOptions(screen.getByLabelText('Reply tone'), 'friendly')
    expect(screen.queryByLabelText('Editable reply draft')).not.toBeInTheDocument()
    await screen.findByRole('button', { name: 'Draft a reply' })
    await user.click(screen.getByRole('button', { name: 'Draft a reply' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Copy reply' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(REPLY.draft))
    expect(api.draft).toHaveBeenLastCalledWith(expect.any(String), 'friendly', '', expect.any(AbortSignal))
  })

  it('saves a follow-up and disables duplicate saving', async () => {
    render(<App />)
    const user = await openPage('Customer inbox')
    await user.type(screen.getByLabelText('Customer message'), 'My mug arrived broken')
    await user.click(screen.getByRole('button', { name: 'Analyze message' }))
    await user.click(await screen.findByRole('button', { name: 'Save follow-up as a task' }))
    expect(await screen.findByRole('button', { name: 'Follow-up task saved' })).toBeDisabled()
    expect(api.createTasks).toHaveBeenCalledOnce()
    expect(vi.mocked(api.createTasks).mock.calls[0][0][0].description).toContain('My mug arrived broken')
  })

  it('extracts, selects, edits, and saves order tasks', async () => {
    vi.mocked(api.createTasks).mockResolvedValue({ tasks: [TASK], created_count: 1, skipped_count: 0 })
    render(<App />)
    const user = await openPage('Order to tasks')
    await user.click(screen.getByRole('button', { name: 'Try an example' }))
    await user.click(screen.getByRole('button', { name: 'Extract order tasks' }))
    expect(await screen.findByText('Alex Morgan')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Select task 2' }))
    await user.clear(screen.getByLabelText('Task 1 title'))
    await user.type(screen.getByLabelText('Task 1 title'), 'Confirm Alex order')
    await user.click(screen.getByRole('button', { name: 'Save 1 selected task' }))
    expect(await screen.findByRole('button', { name: 'Tasks saved' })).toBeDisabled()
    expect(api.createTasks).toHaveBeenCalledWith(
      [expect.objectContaining({ title: 'Confirm Alex order' })],
      expect.any(AbortSignal),
    )
  })

  it('creates, filters, completes, and deletes persistent tasks', async () => {
    vi.mocked(api.tasks).mockResolvedValue([TASK])
    vi.mocked(api.createTasks).mockResolvedValue({
      tasks: [{ ...TASK, id: 'task-2', title: 'Call Alex', order_reference: null }],
      created_count: 1,
      skipped_count: 0,
    })
    render(<App />)
    const user = await openPage('My tasks')
    await screen.findByRole('heading', { name: TASK.title })
    await user.click(screen.getByRole('button', { name: 'New task' }))
    await user.type(screen.getByLabelText('Task title', { exact: false }), 'Call Alex')
    await user.click(screen.getByRole('button', { name: /^Create task$/ }))
    await waitFor(() =>
      expect(api.createTasks).toHaveBeenCalledWith(
        [expect.objectContaining({ title: 'Call Alex' })],
        undefined,
      ),
    )
    await user.type(screen.getByLabelText('Search tasks'), 'no-such-task')
    expect(screen.getByText('No matching tasks')).toBeInTheDocument()
    await user.clear(screen.getByLabelText('Search tasks'))
    await user.click(screen.getByRole('button', { name: `Complete ${TASK.title}` }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: `Reopen ${TASK.title}` })).toBeInTheDocument(),
    )
    await user.click(screen.getByRole('button', { name: `Delete ${TASK.title}` }))
    expect(screen.getByText('Delete this task permanently?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Delete task$/ }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: TASK.title })).not.toBeInTheDocument())
    expect(api.deleteTask).toHaveBeenCalledWith(TASK.id)
  })

  it('retains drafts when navigating between screens', async () => {
    render(<App />)
    const user = await openPage('Customer inbox')
    await user.type(screen.getByLabelText('Customer message'), 'Keep this message')
    await openPage('My tasks')
    await openPage('Customer inbox')
    expect(screen.getByLabelText('Customer message')).toHaveValue('Keep this message')
  })

  it('shows a useful error and supports retry instead of failing silently', async () => {
    vi.mocked(api.classify).mockRejectedValueOnce(new Error('Provider is unavailable'))
    render(<App />)
    const user = await openPage('Customer inbox')
    await user.type(screen.getByLabelText('Customer message'), 'Where is my order?')
    await user.click(screen.getByRole('button', { name: 'Analyze message' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Provider is unavailable')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('A mug arrived broken.')).toBeInTheDocument()
  })

  it('explains missing AI configuration without disabling local workflows', async () => {
    render(<App />)
    const user = await openPage('AI assistant')
    expect(await screen.findByText('AI chat needs a Groq API key.')).toBeInTheDocument()
    expect(screen.getByLabelText('Message BizPilot')).toBeDisabled()
    await openPage('Customer inbox')
    await user.click(screen.getByRole('button', { name: 'Try an example' }))
    expect(screen.getByRole('button', { name: 'Analyze message' })).toBeEnabled()
  })

  it('supports AI chat with conversation history', async () => {
    vi.mocked(api.health).mockResolvedValue({ ...HEALTH, ai_configured: true })
    render(<App />)
    const user = await openPage('AI assistant')
    await screen.findByRole('button', { name: 'Groq configured' })
    await user.type(screen.getByLabelText('Message BizPilot'), 'How do I handle a late order?')
    await user.click(screen.getByRole('button', { name: 'Send message' }))
    expect(await screen.findByText('Try asking for the order reference.')).toBeInTheDocument()
    expect(api.chat).toHaveBeenCalledWith('How do I handle a late order?', [], expect.any(AbortSignal))
    await user.type(screen.getByLabelText('Message BizPilot'), 'What next?')
    fireEvent.submit(screen.getByRole('button', { name: 'Send message' }).closest('form')!)
    await waitFor(() =>
      expect(api.chat).toHaveBeenLastCalledWith(
        'What next?',
        expect.arrayContaining([
          { role: 'user', content: 'How do I handle a late order?' },
          { role: 'assistant', content: 'Try asking for the order reference.' },
        ]),
        expect.any(AbortSignal),
      ),
    )
  })

  it('shows offline state and reconnects', async () => {
    vi.mocked(api.health).mockRejectedValueOnce(new Error('Cannot reach the API'))
    render(<App />)
    expect(await screen.findByRole('button', { name: 'API offline' })).toBeInTheDocument()
    expect(screen.getByText(/Can’t reach the backend/)).toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Reconnect' }))
    expect(await screen.findByRole('button', { name: 'Local mode' })).toBeInTheDocument()
  })

  it('renders task content as text, never executable HTML', async () => {
    const unsafe = '<img src=x onerror=alert(1)>'
    vi.mocked(api.tasks).mockResolvedValue([{ ...TASK, title: unsafe } as Task])
    render(<App />)
    await openPage('My tasks')
    expect(await screen.findByRole('heading', { name: unsafe })).toBeInTheDocument()
    expect(document.querySelector('img[src="x"]')).not.toBeInTheDocument()
  })
})
