/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
    // Ensure the "posts" collection exists; create it only if it is missing.
    let collection
    try {
        collection = app.findCollectionByNameOrId("posts")
    } catch (err) {
        collection = null
    }

    if (collection === null) {
        collection = new Collection({
            type:       "base",
            name:       "posts",
            // empty string rule => public access (everyone, including guests)
            listRule:   "",
            viewRule:   "",
            createRule: "",
            updateRule: "",
            deleteRule: "",
            fields: [
                {
                    type:     "text",
                    name:     "title",
                    required: true,
                },
                {
                    type: "text",
                    name: "slug",
                },
            ],
        })

        app.save(collection)
    }
}, (app) => {
    // optional revert: delete the "posts" collection if it exists
    try {
        let collection = app.findCollectionByNameOrId("posts")
        app.delete(collection)
    } catch (err) {
        // silent errors (probably already deleted)
    }
})