import { HttpError } from 'wasp/server'

export const getDocuments = async (args: any, context: any) => {
  if (!context.user) {
    throw new HttpError(401, 'Unauthorized')
  }

  const userId = context.user.id

  return context.entities.Document.findMany({
    where: {
      OR: [
        { ownerId: userId },
        {
          permissions: {
            some: {
              userId: userId,
            },
          },
        },
      ],
    },
    orderBy: {
      updatedAt: 'desc',
    },
  })
}

export const getDocument = async (args: { id: number }, context: any) => {
  if (!context.user) {
    throw new HttpError(401, 'Unauthorized')
  }

  const userId = context.user.id
  const docId = Number(args.id)

  const document = await context.entities.Document.findUnique({
    where: { id: docId },
    include: {
      owner: true,
      versions: {
        include: {
          author: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
      permissions: {
        include: {
          user: true,
        },
      },
    },
  })

  if (!document) {
    throw new HttpError(404, 'Document not found')
  }

  const isOwner = document.ownerId === userId
  const hasPermission = document.permissions.some((p: any) => p.userId === userId)

  if (!isOwner && !hasPermission) {
    throw new HttpError(403, 'Access Denied')
  }

  let role = 'VIEW'
  if (isOwner) {
    role = 'OWNER'
  } else {
    const perm = document.permissions.find((p: any) => p.userId === userId)
    if (perm) {
      role = perm.role
    }
  }

  return {
    ...document,
    userRole: role,
  }
}

export const getPermissions = async (args: { documentId: number }, context: any) => {
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

  return context.entities.Permission.findMany({
    where: { documentId: docId },
    include: {
      user: true,
    },
  })
}
