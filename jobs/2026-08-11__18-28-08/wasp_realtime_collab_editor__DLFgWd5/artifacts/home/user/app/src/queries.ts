import { HttpError } from 'wasp/server'

export const getDocuments = async (args: any, context: any) => {
  if (!context.user) {
    throw new HttpError(401, 'Unauthorized')
  }

  return context.entities.Document.findMany({
    where: {
      OR: [
        { ownerId: context.user.id },
        {
          permissions: {
            some: {
              userId: context.user.id
            }
          }
        }
      ]
    },
    orderBy: {
      updatedAt: 'desc'
    }
  })
}

export const getDocument = async (args: { id: number }, context: any) => {
  if (!context.user) {
    throw new HttpError(401, 'Unauthorized')
  }

  const document = await context.entities.Document.findUnique({
    where: { id: args.id },
    include: {
      owner: true,
      versions: {
        include: {
          author: true
        },
        orderBy: {
          createdAt: 'asc'
        }
      },
      permissions: {
        include: {
          user: true
        }
      }
    }
  })

  if (!document) {
    throw new HttpError(404, 'Document not found')
  }

  const isOwner = document.ownerId === context.user.id
  const permission = document.permissions.find((p: any) => p.userId === context.user.id)

  if (!isOwner && !permission) {
    throw new HttpError(403, 'Access Denied')
  }

  const userRole = isOwner ? 'OWNER' : permission.role

  return {
    document,
    userRole
  }
}
