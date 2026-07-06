package migrations

import (
"github.com/pocketbase/dbx"
pbmigrations "github.com/pocketbase/pocketbase/migrations"
"github.com/pocketbase/pocketbase/daos"
"github.com/pocketbase/pocketbase/models"
"github.com/pocketbase/pocketbase/models/schema"
"github.com/pocketbase/pocketbase/tools/types"
)

func init() {
pbmigrations.AppMigrations.Register(
func(db dbx.Builder) error {
dao := daos.New(db)

emptyRule := types.Pointer("")

collection := &models.Collection{
Name: "configs",
Type: models.CollectionTypeBase,
Schema: schema.NewSchema(
&schema.SchemaField{
Name:     "key",
Type:     schema.FieldTypeText,
Required: true,
},
&schema.SchemaField{
Name: "value",
Type: schema.FieldTypeText,
},
),
ListRule: emptyRule,
ViewRule: emptyRule,
}

if err := dao.SaveCollection(collection); err != nil {
return err
}

record1 := models.NewRecord(collection)
record1.Set("key", "site_name")
record1.Set("value", "My Site")

record2 := models.NewRecord(collection)
record2.Set("key", "maintenance_mode")
record2.Set("value", "false")

if err := dao.SaveRecord(record1); err != nil {
return err
}
if err := dao.SaveRecord(record2); err != nil {
return err
}

return nil
},
func(db dbx.Builder) error {
dao := daos.New(db)
collection, err := dao.FindCollectionByNameOrId("configs")
if err != nil {
return err
}
return dao.DeleteCollection(collection)
},
)
}
