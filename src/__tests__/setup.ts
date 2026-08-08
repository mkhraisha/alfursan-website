import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// vitest.config.ts doesn't enable `test.globals`, so @testing-library/react's
// automatic afterEach-cleanup (which relies on detecting a global test
// framework) never registers. Without this, unmounted components from a
// previous test in the same file linger in the jsdom document and cause
// "found multiple elements" failures in later tests.
afterEach(cleanup);
