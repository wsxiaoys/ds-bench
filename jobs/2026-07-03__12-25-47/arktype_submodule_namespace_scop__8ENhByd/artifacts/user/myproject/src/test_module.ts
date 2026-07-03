import { scope, Module } from 'arktype';

// Approach 8: Use new Module() with unparsed values
const dbModule: any = new Module({
  User: { id: 'string.uuid' },
  Org: { id: 'string.uuid' }
});
const apiModule: any = new Module({
  CreateUserRequest: { user: 'db.User' },
  CreateOrgRequest: { org: 'db.Org' }
});
console.log('dbModule:', dbModule.constructor.name);
console.log('dbModule.User:', dbModule.User);

const outer = scope({
  db: dbModule,
  api: apiModule
});
const exported = outer.export();
console.log('exported.db:', exported.db?.constructor?.name);
console.log('exported.db.User:', exported.db?.User);
console.log('exported.api.CreateUserRequest:', exported.api?.CreateUserRequest);
console.log('exported.api.CreateUserRequest.expression:', exported.api?.CreateUserRequest?.expression);
