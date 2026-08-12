import { z } from 'zod'
import { idSchema, timestampSchema } from './ids'

/**
 * Identity, session, workspace, and membership contracts.
 *
 * Raw user data is private by default: the user record that crosses a public
 * boundary is `publicUserSchema`, which never exposes the password hash.
 */

export const emailSchema = z.string().trim().toLowerCase().email().max(254)

export type Email = z.infer<typeof emailSchema>

export const passwordSchema = z.string().min(8).max(128)

export const displayNameSchema = z.string().trim().min(1).max(200)

export const registerInputSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
})

export type RegisterInput = z.infer<typeof registerInputSchema>

export const loginInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
})

export type LoginInput = z.infer<typeof loginInputSchema>

/** A user's role within a workspace. `owner` outranks `member`. */
export const workspaceRoleSchema = z.enum(['owner', 'member'])

export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>

export const workspaceKindSchema = z.enum(['personal', 'team'])

export type WorkspaceKind = z.infer<typeof workspaceKindSchema>

export const userSchema = z.object({
  id: idSchema,
  email: emailSchema,
  passwordHash: z.string().min(1),
  displayName: z.string().min(1),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

export type User = z.infer<typeof userSchema>

/** User shape safe to expose publicly (no password hash). */
export const publicUserSchema = userSchema.omit({ passwordHash: true })

export type PublicUser = z.infer<typeof publicUserSchema>

export const sessionSchema = z.object({
  id: idSchema,
  userId: idSchema,
  tokenHash: z.string().min(1),
  createdAt: timestampSchema,
  expiresAt: timestampSchema,
  revokedAt: timestampSchema.nullable(),
})

export type Session = z.infer<typeof sessionSchema>

export const workspaceSchema = z.object({
  id: idSchema,
  slug: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  kind: workspaceKindSchema,
  ownerUserId: idSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

export type Workspace = z.infer<typeof workspaceSchema>

export const membershipSchema = z.object({
  workspaceId: idSchema,
  userId: idSchema,
  role: workspaceRoleSchema,
  createdAt: timestampSchema,
})

export type Membership = z.infer<typeof membershipSchema>

export const createWorkspaceInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/, 'slug must be lowercase letters, digits, and hyphens only'),
})

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceInputSchema>
