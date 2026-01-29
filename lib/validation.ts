import { z } from 'zod'

/**
 * Schema for creating/updating client configurations
 */
export const clientSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(255, 'Name must be 255 characters or less')
    .trim(),

  sftpHost: z
    .string()
    .min(1, 'SFTP host is required')
    .regex(
      /^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/,
      'SFTP host must contain only alphanumeric characters, dots, and hyphens'
    ),

  sftpPort: z
    .number()
    .int('Port must be an integer')
    .min(1, 'Port must be at least 1')
    .max(65535, 'Port must be 65535 or less'),

  sftpUsername: z
    .string()
    .min(1, 'Username is required')
    .max(255, 'Username must be 255 characters or less')
    .trim(),

  sftpPassword: z
    .string()
    .min(1, 'Password is required')
    .max(500, 'Password must be 500 characters or less'),

  sftpFolderPath: z
    .string()
    .min(1, 'Folder path is required')
    .max(500, 'Folder path must be 500 characters or less')
    .regex(/^\//, 'Folder path must start with /'),
})

/**
 * Schema for querying audience members
 */
export const audienceSearchSchema = z.object({
  page: z
    .number()
    .int('Page must be an integer')
    .min(1, 'Page must be at least 1')
    .optional(),

  limit: z
    .number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit must be 100 or less')
    .optional(),

  clientId: z
    .number()
    .int('Client ID must be an integer')
    .optional(),

  search: z
    .string()
    .max(100, 'Search query must be 100 characters or less')
    .optional(),
})

// Export inferred types for use in application code
export type ClientInput = z.infer<typeof clientSchema>
export type AudienceSearchInput = z.infer<typeof audienceSearchSchema>
