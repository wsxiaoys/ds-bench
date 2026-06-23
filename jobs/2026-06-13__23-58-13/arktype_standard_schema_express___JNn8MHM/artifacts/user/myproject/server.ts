import express from 'express';
import { type } from 'arktype';

const app = express();
app.use(express.json());

const userSchema = type({
    username: "string.alphanumeric >= 3 <= 20",
    email: "string.email",
    "age?": "number.integer >= 13 <= 120"
});

const searchSchema = type({
    q: "string >= 1 <= 100",
    page: "string.numeric.parse |> number.integer >= 1",
    limit: "string.numeric.parse |> number.integer >= 1 <= 50"
});

export function validate(source: 'body' | 'query', schema: any) {
    return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
        try {
            const standardSchema = schema["~standard"];
            if (!standardSchema) {
                throw new Error("Schema does not support Standard Schema Interface");
            }
            const result = await standardSchema.validate(req[source]);
            
            if (result.issues) {
                res.status(400).json({ issues: result.issues });
                return;
            }
            
            req[source] = result.value;
            next();
        } catch (err) {
            next(err);
        }
    };
}

app.post('/users', validate('body', userSchema), (req, res) => {
    res.status(201).json(req.body);
});

app.get('/search', validate('query', searchSchema), (req, res) => {
    res.status(200).json(req.query);
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
