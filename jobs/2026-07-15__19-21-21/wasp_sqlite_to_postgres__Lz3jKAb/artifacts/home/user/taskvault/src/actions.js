export const createTask = async ({ description }, context) => {
  return context.entities.Task.create({ data: { description } })
}
