// Zod 4 reworded its default issue messages ("Required" became "Invalid input:
// expected string, received undefined"). The error handler returns the first
// issue's message to the client, so this map keeps the wording the API has
// always sent. Messages set on a schema (e.g. `.min(3, "...")`) take precedence
// over it; returning undefined falls through to Zod's own default.
const describeReceived = (input) => {
    if (input === null) return "null";
    if (Array.isArray(input)) return "array";
    if (input instanceof Date) return "date";
    if (typeof input === "number" && Number.isNaN(input)) return "nan";
    return typeof input;
};

const legacyIssueMessage = (issue) => {
    if (issue.code === "invalid_type") {
        return issue.input === undefined
            ? "Required"
            : `Expected ${issue.expected}, received ${describeReceived(issue.input)}`;
    }

    if (issue.code === "unrecognized_keys") {
        return `Unrecognized key(s) in object: ${issue.keys.map((key) => `'${key}'`).join(", ")}`;
    }

    return undefined;
};

const validate = (schema, source = "body") => (req, res, next) => {
    const result = schema.safeParse(req[source], { error: legacyIssueMessage });

    if (!result.success) {
        return next(result.error);
    }

    req[source] = result.data;
    next();
};

export { validate };
