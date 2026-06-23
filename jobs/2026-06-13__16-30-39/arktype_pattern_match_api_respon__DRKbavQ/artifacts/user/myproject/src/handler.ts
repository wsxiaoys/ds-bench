import { match } from "arktype"

const handleResponse = match.at("status")({
  "'success'": (input) => `OK:${JSON.stringify(input.data)}`,
  "'error'": (input) => `ERR ${input.code} ${input.reason}`,
  "'pending'": () => "PENDING"
}).default("assert")

const input = JSON.parse(
  await new Promise<string>((resolve) => {
    let data = ""
    process.stdin.on("data", (chunk) => (data += chunk))
    process.stdin.on("end", () => resolve(data))
  })
)

try {
  const result = handleResponse(input)
  console.log(result)
} catch (err) {
  process.exit(1)
}