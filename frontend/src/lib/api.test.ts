import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";
import { describe, expect, test } from "vitest";
import { getErrorMessage } from "./api";

const httpError = (status: number, message: string) => {
    const config = { headers: new AxiosHeaders() };
    const response = { status, statusText: "", headers: {}, config, data: { success: false, message } } as AxiosResponse;
    return new AxiosError(message, "ERR_BAD_RESPONSE", config, {}, response);
};

describe("getErrorMessage", () => {
    test("keeps the API's own wording for a request the user can fix", () => {
        expect(getErrorMessage(httpError(400, "Username is already taken"), "fallback")).toBe("Username is already taken");
    });

    test("never shows a log-style server message to people", () => {
        expect(getErrorMessage(httpError(500, "Server error"), "fallback")).toBe("Bridge hit a problem on its side. Try again in a moment.");
    });
});
