import { z } from "zod";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
//#region src/schemas.ts
var allowedFields = [
	"id",
	"name",
	"email",
	"department",
	"salary"
];
var allowedDirections = ["asc", "desc"];
var strictQuerySchema = z.object({
	q: z.string().default(""),
	sort: z.string().default("id:asc").refine((val) => {
		if (!val) return true;
		return val.split(",").every((token) => {
			const parts = token.split(":");
			if (parts.length !== 2) return false;
			const [field, dir] = parts;
			return allowedFields.includes(field) && allowedDirections.includes(dir);
		});
	}, { message: "Invalid sort parameter format. Must be comma-separated 'field:direction' tokens, where field is id/name/email/department/salary and direction is asc/desc." }),
	page: z.preprocess((val) => {
		if (val === void 0 || val === null || val === "") return void 0;
		if (typeof val === "string") {
			const parsed = parseInt(val, 10);
			return isNaN(parsed) ? val : parsed;
		}
		return val;
	}, z.number().int().min(1).default(1)),
	pageSize: z.preprocess((val) => {
		if (val === void 0 || val === null || val === "") return void 0;
		if (typeof val === "string") {
			const parsed = parseInt(val, 10);
			return isNaN(parsed) ? val : parsed;
		}
		return val;
	}, z.number().int().min(1).max(100).default(8))
});
var db = new DatabaseSync(path.resolve(process.cwd(), "employees.db"));
db.exec(`
  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    department TEXT NOT NULL,
    salary INTEGER NOT NULL
  )
`);
if (db.prepare("SELECT COUNT(*) as count FROM employees").get().count === 0) {
	const insert = db.prepare(`
    INSERT INTO employees (id, name, email, department, salary)
    VALUES (?, ?, ?, ?, ?)
  `);
	for (const row of [
		[
			1,
			"Alice Johnson",
			"mailto:alice.johnson@corp.test",
			"Engineering",
			95e3
		],
		[
			2,
			"Bob Smith",
			"mailto:bob.smith@corp.test",
			"Sales",
			62e3
		],
		[
			3,
			"Carol Nguyen",
			"mailto:carol.nguyen@corp.test",
			"Engineering",
			88e3
		],
		[
			4,
			"David Lee",
			"mailto:david.lee@corp.test",
			"Support",
			54e3
		],
		[
			5,
			"Emma Brown",
			"mailto:emma.brown@corp.test",
			"Design",
			71e3
		],
		[
			6,
			"Frank Wilson",
			"mailto:frank.wilson@corp.test",
			"Sales",
			67e3
		],
		[
			7,
			"Grace Kim",
			"mailto:grace.kim@corp.test",
			"Engineering",
			102e3
		],
		[
			8,
			"Henry Davis",
			"mailto:henry.davis@corp.test",
			"Support",
			58e3
		],
		[
			9,
			"Ivy Martinez",
			"mailto:ivy.martinez@corp.test",
			"Design",
			76e3
		],
		[
			10,
			"Jack Nguyen",
			"mailto:jack.nguyen@corp.test",
			"Sales",
			69e3
		],
		[
			11,
			"Karen Miller",
			"mailto:karen.miller@corp.test",
			"Support",
			6e4
		],
		[
			12,
			"Leo Garcia",
			"mailto:leo.garcia@corp.test",
			"Engineering",
			91e3
		],
		[
			13,
			"Mia Rodriguez",
			"mailto:mia.rodriguez@corp.test",
			"Design",
			73e3
		],
		[
			14,
			"Noah Anderson",
			"mailto:noah.anderson@corp.test",
			"Sales",
			64e3
		],
		[
			15,
			"Olivia Thomas",
			"mailto:olivia.thomas@corp.test",
			"Engineering",
			99e3
		],
		[
			16,
			"Paul Nguyen",
			"mailto:paul.nguyen@corp.test",
			"Support",
			57e3
		],
		[
			17,
			"Quinn Taylor",
			"mailto:quinn.taylor@corp.test",
			"Design",
			78e3
		],
		[
			18,
			"Ruby Moore",
			"mailto:ruby.moore@corp.test",
			"Sales",
			66e3
		],
		[
			19,
			"Sam Jackson",
			"mailto:sam.jackson@corp.test",
			"Engineering",
			105e3
		],
		[
			20,
			"Tina White",
			"mailto:tina.white@corp.test",
			"Support",
			59e3
		],
		[
			21,
			"Uma Harris",
			"mailto:uma.harris@corp.test",
			"Design",
			74e3
		],
		[
			22,
			"Victor Clark",
			"mailto:victor.clark@corp.test",
			"Sales",
			63e3
		],
		[
			23,
			"Wendy Lewis",
			"mailto:wendy.lewis@corp.test",
			"Engineering",
			97e3
		],
		[
			24,
			"Xander Walker",
			"mailto:xander.walker@corp.test",
			"Support",
			56e3
		]
	]) insert.run(row[0], row[1], row[2], row[3], row[4]);
}
//#endregion
//#region src/utils/employees.ts
function queryEmployees(params) {
	const { q, sort, page, pageSize } = params;
	let countSql = "SELECT COUNT(*) as count FROM employees";
	let selectSql = "SELECT * FROM employees";
	const queryArgs = [];
	if (q && q.trim() !== "") {
		const filterClause = " WHERE name LIKE ? OR email LIKE ?";
		countSql += filterClause;
		selectSql += filterClause;
		const likeVal = `%${q}%`;
		queryArgs.push(likeVal, likeVal);
	}
	const sortTokens = sort ? sort.split(",") : [];
	const orderByParts = [];
	for (const token of sortTokens) {
		const [field, dir] = token.split(":");
		if (field && dir) orderByParts.push(`"${field}" ${dir.toUpperCase()}`);
	}
	if (orderByParts.length > 0) selectSql += ` ORDER BY ${orderByParts.join(", ")}`;
	else selectSql += " ORDER BY id ASC";
	const limit = pageSize;
	const offset = (page - 1) * pageSize;
	selectSql += " LIMIT ? OFFSET ?";
	const total = db.prepare(countSql).get(...queryArgs).count;
	return {
		rows: db.prepare(selectSql).all(...queryArgs, limit, offset),
		total,
		page,
		pageSize,
		pageCount: Math.max(1, Math.ceil(total / pageSize))
	};
}
//#endregion
export { strictQuerySchema as n, queryEmployees as t };
