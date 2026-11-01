export type Category = 'order' | 'complaint' | 'refund' | 'inquiry' | 'feedback' | 'other'
export type Priority = 'low' | 'normal' | 'high' | 'urgent'
export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type Tone = 'professional' | 'friendly' | 'concise'
export type Page = 'dashboard' | 'inbox' | 'orders' | 'tasks' | 'assistant'

export interface Health {
  status: 'ok'
  ai_configured: boolean
  task_storage: 'sqlite'
}

export interface Classification {
  category: Category
  priority: Priority
  sentiment: 'positive' | 'neutral' | 'negative'
  summary: string
  suggested_action: string
  engine: 'groq' | 'rules'
  warning: string | null
}

export interface ReplyDraft {
  draft: string
  category: Category
  engine: 'groq' | 'rules'
  warning: string | null
}

export interface TaskInput {
  title: string
  description: string
  priority: Priority
  order_reference: string | null
  due_date: string | null
}

export interface Task extends TaskInput {
  id: string
  status: TaskStatus
  created_at: string
  updated_at: string
}

export interface TaskBatchResult {
  tasks: Task[]
  created_count: number
  skipped_count: number
}

export interface OrderExtraction {
  order_reference: string | null
  customer_name: string | null
  items: { name: string; quantity: number }[]
  tasks: TaskInput[]
  missing_fields: string[]
  engine: 'groq' | 'rules'
  warning: string | null
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export const CATEGORY_LABELS: Record<Category, string> = {
  order: 'Order request',
  complaint: 'Complaint',
  refund: 'Refund request',
  inquiry: 'Question',
  feedback: 'Feedback',
  other: 'General',
}
export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Completed',
}
export const PRIORITIES: Priority[] = ['low', 'normal', 'high', 'urgent']
