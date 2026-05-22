import { setTimeout as delay } from 'node:timers/promises'
import { ImapFlow } from 'imapflow'
import type { FetchMessageObject, MessageAddressObject } from 'imapflow'

export interface LiveEmailConfig {
  gmailUser: string
  gmailAppPassword: string
  liveEmailTo: string
  timeoutMs: number
}

export interface ReceivedEmail {
  subject: string
  from: string
  to: string
  date: Date
  source: string
  mailbox: string
}

export function getLiveEmailConfig(): LiveEmailConfig | null {
  const gmailUser = process.env.GMAIL_USER
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD
  const liveEmailTo = process.env.LIVE_EMAIL_TO || process.env.SMTP_USER
  const parsedTimeoutMs = Number(process.env.LIVE_EMAIL_TIMEOUT_MS || 60000)
  const timeoutMs =
    Number.isFinite(parsedTimeoutMs) && parsedTimeoutMs > 0
      ? parsedTimeoutMs
      : 60000

  if (!gmailUser || !gmailAppPassword || !liveEmailTo) {
    return null
  }

  return {
    gmailUser,
    gmailAppPassword,
    liveEmailTo,
    timeoutMs,
  }
}

export async function waitForEmailBySubject({
  subject,
  since,
  timeoutMs,
}: {
  subject: string
  since: Date
  timeoutMs: number
}): Promise<ReceivedEmail> {
  const config = getLiveEmailConfig()

  if (!config) {
    throw new Error(
      'Inbox polling configuration missing: set GMAIL_USER, GMAIL_APP_PASSWORD, and LIVE_EMAIL_TO or SMTP_USER.'
    )
  }

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
      user: config.gmailUser,
      pass: config.gmailAppPassword,
    },
    disableAutoIdle: true,
    logger: false,
  })

  const deadline = Date.now() + timeoutMs

  try {
    await client.connect()
    const mailboxes = await getSearchMailboxes(client)

    while (Date.now() < deadline) {
      for (const mailbox of mailboxes) {
        await client.mailboxOpen(mailbox)

        const messageIds = await client.search({ all: true })

        if (messageIds && messageIds.length > 0) {
          const recentMessageIds = messageIds.slice(-50)
          const messages = await client.fetchAll(recentMessageIds, {
            envelope: true,
            internalDate: true,
            source: true,
          })

          const matchingMessage = messages
            .filter((message) => subjectMatches(message, subject))
            .filter((message) => getMessageDate(message).getTime() >= since.getTime())
            .sort((a, b) => getMessageDate(b).getTime() - getMessageDate(a).getTime())[0]

          if (matchingMessage) {
            return {
              subject: matchingMessage.envelope?.subject || subject,
              from: formatAddresses(matchingMessage.envelope?.from),
              to: formatAddresses(matchingMessage.envelope?.to),
              date: getMessageDate(matchingMessage),
              source: matchingMessage.source?.toString('utf8') || '',
              mailbox,
            }
          }
        }
      }

      const remainingMs = deadline - Date.now()
      if (remainingMs > 0) {
        await delay(Math.min(5000, remainingMs))
      }
    }
  } finally {
    try {
      await client.logout()
    } catch {
      client.close()
    }
  }

  throw new Error(
    `Inbox polling timed out after ${timeoutMs}ms waiting for exact subject "${subject}".`
  )
}

async function getSearchMailboxes(client: ImapFlow): Promise<string[]> {
  const mailboxes = await client.list()
  const availablePaths = new Set(mailboxes.map((mailbox) => mailbox.path))
  const searchPaths = ['INBOX', '[Gmail]/All Mail', '[Gmail]/Spam']

  return searchPaths.filter((path) => availablePaths.has(path))
}

function subjectMatches(message: FetchMessageObject, subject: string): boolean {
  const messageSubject = message.envelope?.subject || ''
  const source = message.source?.toString('utf8') || ''

  return messageSubject === subject || source.includes(subject)
}

function getMessageDate(message: FetchMessageObject): Date {
  const rawDate = message.internalDate || message.envelope?.date
  const date = rawDate instanceof Date ? rawDate : new Date(rawDate || 0)

  if (Number.isNaN(date.getTime())) {
    return new Date(0)
  }

  return date
}

function formatAddresses(addresses?: MessageAddressObject[]): string {
  return (addresses || [])
    .map((address) => {
      if (!address.address) return ''
      return address.name ? `${address.name} <${address.address}>` : address.address
    })
    .filter(Boolean)
    .join(', ')
}
