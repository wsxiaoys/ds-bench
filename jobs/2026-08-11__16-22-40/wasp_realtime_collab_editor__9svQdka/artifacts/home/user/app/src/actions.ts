import { HttpError } from 'wasp/server'
import { ioInstance } from './webSocket'

export const createDocument = async (args: { title: string }, context: any) => {
  if (!context.user) {
    throw new HttpError(401, 'Unauthorized')
  }
  if (!args.title || args.title.trim() === '') {
    throw new HttpError(400, 'Title is required')
  }

  return context.entities.Document.create({
    data: {
      title: args.title.trim(),
      content: '',
      ownerId: context.user.id,
    },
  })
}

export const updateDocumentContent = async (args: { id: number, content: string }, context: any) => {
  if (!context.user) {
    throw new HttpError(401, 'Unauthorized')
  }

  const userId = context.user.id
  const docId = Number(args.id)

  const document = await context.entities.Document.findUnique({
    where: { id: docId },
    include: {
      permissions: true,
    },
  })

  if (!document) {
    throw new HttpError(404, 'Document not found')
  }

  const isOwner = document.ownerId === userId
  const hasEditPermission = document.permissions.some((p: any) => p.userId === userId && p.role === 'EDIT')

  if (!isOwner && !hasEditPermission) {
    throw new HttpError(403, 'Access Denied')
  }

  const updatedDoc = await context.entities.Document.update({
    where: { id: docId },
    data: {
      content: args.content,
    },
  })

  if (ioInstance) {
    const roomId = `document-${docId}`
    ioInstance.to(roomId).emit('documentEdit', { content: args.content })
  }

  return updatedDoc
}

export const saveVersion = async (args: { documentId: number, content: string }, context: any) => {
  if (!context.user) {
    throw new HttpError(401, 'Unauthorized')
  }

  const userId = context.user.id
  const docId = Number(args.documentId)

  const document = await context.entities.Document.findUnique({
    where: { id: docId },
    include: {
      permissions: true,
    },
  })

  if (!document) {
    throw new HttpError(404, 'Document not found')
  }

  const isOwner = document.ownerId === userId
  const hasEditPermission = document.permissions.some((p: any) => p.userId === userId && p.role === 'EDIT')

  if (!isOwner && !hasEditPermission) {
    throw new HttpError(403, 'Access Denied')
  }

  const version = await context.entities.Version.create({
    data: {
      documentId: docId,
      content: args.content,
      authorId: userId,
    },
  })

  await context.entities.Document.update({
    where: { id: docId },
    data: {
      content: args.content,
    },
  })

  if (ioInstance) {
    const roomId = `document-${docId}`
    ioInstance.to(roomId).emit('documentEdit', { content: args.content })
  }

  return version
}

export const restoreVersion = async (args: { documentId: number, versionId: number }, context: any) => {
  if (!context.user) {
    throw new HttpError(401, 'Unauthorized')
  }

  const userId = context.user.id
  const docId = Number(args.documentId)
  const versionId = Number(args.versionId)

  const document = await context.entities.Document.findUnique({
    where: { id: docId },
    include: {
      permissions: true,
    },
  })

  if (!document) {
    throw new HttpError(404, 'Document not found')
  }

  const isOwner = document.ownerId === userId
  const hasEditPermission = document.permissions.some((p: any) => p.userId === userId && p.role === 'EDIT')

  if (!isOwner && !hasEditPermission) {
    throw new HttpError(403, 'Access Denied')
  }

  const version = await context.entities.Version.findUnique({
    where: { id: versionId },
  })

  if (!version || version.documentId !== docId) {
    throw new HttpError(404, 'Version not found')
  }

  const updatedDoc = await context.entities.Document.update({
    where: { id: docId },
    data: {
      content: version.content,
    },
  })

  if (ioInstance) {
    const roomId = `document-${docId}`
    ioInstance.to(roomId).emit('documentEdit', { content: version.content })
  }

  return updatedDoc
}

export const shareDocument = async (
  args: { documentId: number; username: string; role: string },
  context: any
) => {
  if (!context.user) {
    throw new HttpError(401, 'Unauthorized')
  }

  const userId = context.user.id
  const docId = Number(args.documentId)

  const document = await context.entities.Document.findUnique({
    where: { id: docId },
  })

  if (!document) {
    throw new HttpError(404, 'Document not found')
  }

  if (document.ownerId !== userId) {
    throw new HttpError(403, 'Access Denied')
  }

  const targetUser = await context.entities.User.findUnique({
    where: { username: args.username },
  })

  if (!targetUser) {
    throw new HttpError(404, 'User not found')
  }

  if (targetUser.id === userId) {
    throw new HttpError(400, 'Cannot share with yourself')
  }

  return context.entities.Permission.upsert({
    where: {
      documentId_userId: {
        documentId: docId,
        userId: targetUser.id,
      },
    },
    update: {
      role: args.role,
    },
    create: {
      documentId: docId,
      userId: targetUser.id,
      role: args.role,
    },
  })
}

export const revokePermission = async (args: { documentId: number, userId: number }, context: any) => {
  if (!context.user) {
    throw new HttpError(401, 'Unauthorized')
  }

  const userId = context.user.id
  const docId = Number(args.documentId)
  const targetUserId = Number(args.userId)

  const document = await context.entities.Document.findUnique({
    where: { id: docId },
  })

  if (!document) {
    throw new HttpError(404, 'Document not found')
  }

  if (document.ownerId !== userId) {
    throw new HttpError(403, 'Access Denied')
  }

  return context.entities.Permission.delete({
    where: {
      documentId_userId: {
        documentId: docId,
        userId: targetUserId,
      },
    },
  })
}
