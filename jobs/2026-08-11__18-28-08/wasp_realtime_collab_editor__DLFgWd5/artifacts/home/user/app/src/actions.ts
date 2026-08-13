import { HttpError } from 'wasp/server'
import { getIO } from './serverIO'

export const createDocument = async (args: { title: string }, context: any) => {
  if (!context.user) {
    throw new HttpError(401, 'Unauthorized')
  }

  return context.entities.Document.create({
    data: {
      title: args.title,
      content: '',
      ownerId: context.user.id
    }
  })
}

export const saveVersion = async (args: { documentId: number, content: string }, context: any) => {
  if (!context.user) {
    throw new HttpError(401, 'Unauthorized')
  }

  const { documentId, content } = args

  const doc = await context.entities.Document.findUnique({
    where: { id: documentId },
    include: {
      permissions: {
        where: { userId: context.user.id }
      }
    }
  })

  if (!doc) {
    throw new HttpError(404, 'Document not found')
  }

  const isOwner = doc.ownerId === context.user.id
  const hasEditPermission = doc.permissions.some((p: any) => p.role === 'EDIT')

  if (!isOwner && !hasEditPermission) {
    throw new HttpError(403, 'Access Denied')
  }

  // Create a new Version
  const version = await context.entities.Version.create({
    data: {
      documentId,
      content,
      authorId: context.user.id
    },
    include: {
      author: true
    }
  })

  // Update primary content
  await context.entities.Document.update({
    where: { id: documentId },
    data: { content }
  })

  // Broadcast to other sockets in the room
  const io = getIO()
  if (io) {
    io.to(`document-${documentId}`).emit('documentEdited', { content })
    io.to(`document-${documentId}`).emit('versionSaved', version)
  }

  return version
}

export const restoreVersion = async (args: { documentId: number, versionId: number }, context: any) => {
  if (!context.user) {
    throw new HttpError(401, 'Unauthorized')
  }

  const { documentId, versionId } = args

  const doc = await context.entities.Document.findUnique({
    where: { id: documentId },
    include: {
      permissions: {
        where: { userId: context.user.id }
      }
    }
  })

  if (!doc) {
    throw new HttpError(404, 'Document not found')
  }

  const isOwner = doc.ownerId === context.user.id
  const hasEditPermission = doc.permissions.some((p: any) => p.role === 'EDIT')

  if (!isOwner && !hasEditPermission) {
    throw new HttpError(403, 'Access Denied')
  }

  const version = await context.entities.Version.findUnique({
    where: { id: versionId }
  })

  if (!version || version.documentId !== documentId) {
    throw new HttpError(404, 'Version not found')
  }

  // Update primary content
  await context.entities.Document.update({
    where: { id: documentId },
    data: { content: version.content }
  })

  // Broadcast to all sockets in the room
  const io = getIO()
  if (io) {
    io.to(`document-${documentId}`).emit('documentEdited', { content: version.content })
    io.to(`document-${documentId}`).emit('documentRestored', { content: version.content })
  }

  return version
}

export const shareDocument = async (args: { documentId: number, username: string, role: string }, context: any) => {
  if (!context.user) {
    throw new HttpError(401, 'Unauthorized')
  }

  const { documentId, username, role } = args

  const doc = await context.entities.Document.findUnique({
    where: { id: documentId }
  })

  if (!doc) {
    throw new HttpError(404, 'Document not found')
  }

  if (doc.ownerId !== context.user.id) {
    throw new HttpError(403, 'Only the owner can share the document')
  }

  // Find user to share with
  const shareUser = await context.entities.User.findUnique({
    where: { username }
  })

  if (!shareUser) {
    throw new HttpError(404, 'User not found')
  }

  if (shareUser.id === context.user.id) {
    throw new HttpError(400, 'Cannot share with yourself')
  }

  // Create or update permission
  return context.entities.Permission.upsert({
    where: {
      documentId_userId: {
        documentId,
        userId: shareUser.id
      }
    },
    create: {
      documentId,
      userId: shareUser.id,
      role
    },
    update: {
      role
    }
  })
}

export const revokePermission = async (args: { documentId: number, userId: number }, context: any) => {
  if (!context.user) {
    throw new HttpError(401, 'Unauthorized')
  }

  const { documentId, userId } = args

  const doc = await context.entities.Document.findUnique({
    where: { id: documentId }
  })

  if (!doc) {
    throw new HttpError(404, 'Document not found')
  }

  if (doc.ownerId !== context.user.id) {
    throw new HttpError(403, 'Only the owner can revoke permissions')
  }

  return context.entities.Permission.delete({
    where: {
      documentId_userId: {
        documentId,
        userId
      }
    }
  })
}
