export interface ClientResult {
  clientName: string
  recordsAdded: number
  recordsSynced: number
  status: 'success' | 'failed'
  error?: string
}

export interface DailySummaryData {
  date: string
  expiredMembers: number
  clientsProcessed: number
  totalRecordsAdded: number
  totalRecordsSynced: number
  clientResults: ClientResult[]
  errors: string[]
}

/**
 * Generates the HTML email for the daily summary report
 * @param data - Summary data from the cron job
 * @returns HTML email string
 */
export function getDailySummaryEmail(data: DailySummaryData): string {
  const {
    date,
    expiredMembers,
    clientsProcessed,
    totalRecordsAdded,
    totalRecordsSynced,
    clientResults,
    errors,
  } = data

  const hasErrors = errors.length > 0
  const statusColor = hasErrors ? '#dc2626' : '#16a34a'
  const statusText = hasErrors ? 'Completed with Errors' : 'Completed Successfully'

  // Build client results table rows
  const clientRows = clientResults
    .map((client) => {
      const rowColor = client.status === 'failed' ? '#fef2f2' : '#ffffff'
      const statusCell = client.status === 'failed'
        ? `<span style="color: #dc2626;">Failed</span>`
        : `<span style="color: #16a34a;">Success</span>`

      return `
        <tr style="background-color: ${rowColor};">
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${client.clientName}</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">${client.recordsAdded}</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">${client.recordsSynced}</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">${statusCell}</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${client.error || '-'}</td>
        </tr>
      `
    })
    .join('')

  // Build errors section
  const errorsSection = hasErrors
    ? `
      <h3 style="color: #dc2626; margin-top: 24px;">Errors</h3>
      <ul style="background-color: #fef2f2; padding: 16px 32px; border-radius: 4px;">
        ${errors.map((error) => `<li style="margin-bottom: 8px;">${error}</li>`).join('')}
      </ul>
    `
    : ''

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Daily Audience Sync Report</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #374151; max-width: 800px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
    <h1 style="margin: 0 0 8px 0; color: #111827;">Daily Audience Sync Report</h1>
    <p style="margin: 0; color: #6b7280;">${date}</p>
  </div>

  <div style="background-color: ${statusColor}; color: white; padding: 12px 16px; border-radius: 4px; margin-bottom: 24px;">
    <strong>Status:</strong> ${statusText}
  </div>

  <h2 style="color: #111827; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">Summary</h2>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
    <tr>
      <td style="padding: 12px; background-color: #f9fafb; border: 1px solid #e5e7eb; width: 50%;"><strong>Clients Processed</strong></td>
      <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: right;">${clientsProcessed}</td>
    </tr>
    <tr>
      <td style="padding: 12px; background-color: #f9fafb; border: 1px solid #e5e7eb;"><strong>Total Records Added</strong></td>
      <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: right;">${totalRecordsAdded}</td>
    </tr>
    <tr>
      <td style="padding: 12px; background-color: #f9fafb; border: 1px solid #e5e7eb;"><strong>Total Records Synced to Meta</strong></td>
      <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: right;">${totalRecordsSynced}</td>
    </tr>
    <tr>
      <td style="padding: 12px; background-color: #f9fafb; border: 1px solid #e5e7eb;"><strong>Expired Members Removed</strong></td>
      <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: right;">${expiredMembers}</td>
    </tr>
  </table>

  <h2 style="color: #111827; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">Client Details</h2>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
    <thead>
      <tr style="background-color: #f3f4f6;">
        <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: left;">Client</th>
        <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;">Records Added</th>
        <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;">Records Synced</th>
        <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: center;">Status</th>
        <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: left;">Error</th>
      </tr>
    </thead>
    <tbody>
      ${clientRows || '<tr><td colspan="5" style="padding: 12px; text-align: center; color: #6b7280;">No clients processed</td></tr>'}
    </tbody>
  </table>

  ${errorsSection}

  <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
    <p>This is an automated message from the Audience Syndication System.</p>
  </div>
</body>
</html>
  `.trim()
}

/**
 * Generates a plain text version of the daily summary
 * @param data - Summary data from the cron job
 * @returns Plain text email string
 */
export function getDailySummaryText(data: DailySummaryData): string {
  const {
    date,
    expiredMembers,
    clientsProcessed,
    totalRecordsAdded,
    totalRecordsSynced,
    clientResults,
    errors,
  } = data

  let text = `Daily Audience Sync Report - ${date}\n`
  text += '='.repeat(50) + '\n\n'

  text += 'SUMMARY\n'
  text += '-'.repeat(30) + '\n'
  text += `Clients Processed: ${clientsProcessed}\n`
  text += `Total Records Added: ${totalRecordsAdded}\n`
  text += `Total Records Synced: ${totalRecordsSynced}\n`
  text += `Expired Members Removed: ${expiredMembers}\n\n`

  text += 'CLIENT DETAILS\n'
  text += '-'.repeat(30) + '\n'
  for (const client of clientResults) {
    text += `${client.clientName}: ${client.recordsAdded} added, ${client.recordsSynced} synced [${client.status}]`
    if (client.error) {
      text += ` - Error: ${client.error}`
    }
    text += '\n'
  }

  if (errors.length > 0) {
    text += '\nERRORS\n'
    text += '-'.repeat(30) + '\n'
    for (const error of errors) {
      text += `- ${error}\n`
    }
  }

  text += '\n---\nAutomated message from Audience Syndication System'

  return text
}
