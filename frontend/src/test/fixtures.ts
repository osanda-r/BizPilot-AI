import type { Classification, Health, OrderExtraction, ReplyDraft, Task } from '../types'

export const HEALTH: Health = { status: 'ok', ai_configured: false, task_storage: 'sqlite' }
export const CLASSIFICATION: Classification = {
  category: 'complaint',
  priority: 'high',
  sentiment: 'negative',
  summary: 'A mug arrived broken.',
  suggested_action: 'Confirm a replacement with the customer.',
  engine: 'rules',
  warning: 'Generated with local rules, not AI.',
}
export const REPLY: ReplyDraft = {
  draft: 'Hello,\n\nThank you for letting us know. Please share your order reference.\n\nCustomer Support',
  category: 'complaint',
  engine: 'rules',
  warning: 'Review this draft before sending.',
}
export const TASK: Task = {
  id: 'task-1',
  title: 'Review and confirm order BP-2048',
  description: 'Check the order details.',
  priority: 'normal',
  status: 'todo',
  order_reference: 'BP-2048',
  due_date: null,
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-01T10:00:00Z',
}
export const EXTRACTION: OrderExtraction = {
  order_reference: 'BP-2048',
  customer_name: 'Alex Morgan',
  items: [{ name: 'Ceramic mug', quantity: 2 }],
  tasks: [
    {
      title: TASK.title,
      description: TASK.description,
      priority: 'normal',
      order_reference: 'BP-2048',
      due_date: null,
    },
    {
      title: 'Prepare 2 × Ceramic mug',
      description: 'Check stock first.',
      priority: 'normal',
      order_reference: 'BP-2048',
      due_date: null,
    },
  ],
  missing_fields: [],
  engine: 'rules',
  warning: 'Review before saving.',
}
