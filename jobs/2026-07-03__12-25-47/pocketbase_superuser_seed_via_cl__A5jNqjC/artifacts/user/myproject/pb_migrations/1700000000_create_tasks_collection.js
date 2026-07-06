/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const tasks = new Collection({
    name: "tasks",
    type: "base",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        name: "title",
        type: "text",
        required: true,
      },
      {
        name: "done",
        type: "bool",
      },
      {
        name: "due",
        type: "date",
      },
    ],
  })

  app.save(tasks)
}, (app) => {
  const collection = app.findCollectionByNameOrId("tasks")
  app.delete(collection)
})
