import { runPipeline, type UserRecord, PipelineT } from './src/pipeline.js'

// Check inferred type of PipelineT
type InferredOut = typeof PipelineT.infer
const _check: InferredOut = [{
  id: '550e8400-e29b-41d4-a716-446655440000',
  age: 25,
  email: 'foo@example.com',
  signupAt: new Date()
}]

const csv = 'id,age,email,signupAt\n550e8400-e29b-41d4-a716-446655440000,25,foo@example.com,2024-01-15T10:30:00Z'
const result = runPipeline(csv)
if (result.ok) {
  const r: UserRecord = result.records[0]
  // These should compile if types are correct
  const _id: string = r.id
  const _age: number = r.age
  const _email: string = r.email
  const _signupAt: Date = r.signupAt
}
