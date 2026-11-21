import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";

// Locks the validation error contract across the Zod 3 -> 4 upgrade. The
// expected strings are exactly what the API sent on Zod 3.25.76; Zod 4's own
// defaults are worded differently, so these fail if the legacy map is dropped.
process.env.LOG_LEVEL = "error";

const { validate } = await import("../src/middlewares/validate.js");
const { errorHandler } = await import("../src/middlewares/errorHandler.js");
const { csrfHeaderSchema, loginSchema, registerSchema } = await import("../src/validators/user.schemas.js");
const {
    createMeetingSchema,
    meetingIdSchema,
    removeParticipantSchema,
    updateMeetingSettingsSchema
} = await import("../src/validators/meeting.schemas.js");

const appFor = (schema, source = "body") => {
    const app = express();
    app.use(express.json());
    app.post("/check", validate(schema, source), (req, res) => res.json({ data: req[source] }));
    app.post("/check/:meetingId", validate(schema, source), (req, res) => res.json({ data: req[source] }));
    app.use(errorHandler);
    return app;
};

const expectValidationError = async (response, message, details) => {
    assert.equal(response.status, 400);
    assert.deepEqual(response.body, {
        success: false,
        message,
        error: { code: "VALIDATION_ERROR", details }
    });
};

test("a missing field is reported as Required", async () => {
    const response = await request(appFor(loginSchema)).post("/check").send({ username: "alice" });

    await expectValidationError(response, "Required", [{ path: "password", message: "Required" }]);
});

test("every missing registration field is listed in order", async () => {
    const response = await request(appFor(registerSchema)).post("/check").send({});

    await expectValidationError(response, "Required", [
        { path: "name", message: "Required" },
        { path: "username", message: "Required" },
        { path: "password", message: "Required" }
    ]);
});

test("a wrongly typed field names the expected and received types", async () => {
    const login = await request(appFor(loginSchema)).post("/check").send({ username: 5, password: "x" });
    await expectValidationError(login, "Expected string, received number", [
        { path: "username", message: "Expected string, received number" }
    ]);

    const nullName = await request(appFor(registerSchema)).post("/check")
        .send({ name: null, username: "alice", password: "Passw0rd" });
    await expectValidationError(nullName, "Expected string, received null", [
        { path: "name", message: "Expected string, received null" }
    ]);

    const settings = await request(appFor(updateMeetingSettingsSchema)).post("/check").send({ allowChat: "false" });
    await expectValidationError(settings, "Expected boolean, received string", [
        { path: "allowChat", message: "Expected boolean, received string" }
    ]);
});

test("unknown meeting settings are rejected with the original wording", async () => {
    const response = await request(appFor(updateMeetingSettingsSchema)).post("/check")
        .send({ isAdmin: true, role: "x" });

    await expectValidationError(response, "Unrecognized key(s) in object: 'isAdmin', 'role'", [
        { path: "", message: "Unrecognized key(s) in object: 'isAdmin', 'role'" },
        { path: "", message: "At least one meeting setting must be provided" }
    ]);
});

test("a missing CSRF header is reported as Required", async () => {
    const response = await request(appFor(csrfHeaderSchema, "headers")).post("/check");

    await expectValidationError(response, "Required", [{ path: "x-csrf-token", message: "Required" }]);
});

test("custom schema messages still win over the legacy defaults", async () => {
    const tooShort = await request(appFor(meetingIdSchema, "params")).post("/check/ab");
    await expectValidationError(tooShort, "Meeting ID must be at least 3 characters long", [
        { path: "meetingId", message: "Meeting ID must be at least 3 characters long" },
        { path: "meetingId", message: "Meeting ID can only contain letters, numbers, hyphens and underscores" }
    ]);

    const empty = await request(appFor(updateMeetingSettingsSchema)).post("/check").send({});
    await expectValidationError(empty, "At least one meeting setting must be provided", [
        { path: "", message: "At least one meeting setting must be provided" }
    ]);
});

test("participant removal keeps both the legacy and the custom message", async () => {
    const missing = await request(appFor(removeParticipantSchema)).post("/check").send({});
    await expectValidationError(missing, "Required", [{ path: "participantUserId", message: "Required" }]);

    const malformed = await request(appFor(removeParticipantSchema)).post("/check")
        .send({ participantUserId: "not-an-object-id" });
    await expectValidationError(malformed, "Participant user ID is invalid", [
        { path: "participantUserId", message: "Participant user ID is invalid" }
    ]);
});

test("valid input is trimmed and passed through", async () => {
    const response = await request(appFor(createMeetingSchema)).post("/check").send({ meetingId: "  design-review  " });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { data: { meetingId: "design-review" } });
});
