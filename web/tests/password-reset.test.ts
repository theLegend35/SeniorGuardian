import assert from "node:assert/strict";
import test from "node:test";

import { resetEmailIssue, resetPasswordIssue } from "@/lib/auth/password-reset";

test("a reset asks for a real email and a matching password", () => {
  assert.equal(resetEmailIssue("not-an-email"), "Enter the email on your account.");
  assert.equal(resetEmailIssue("helen.walsh@demo.seniorhelp.test"), null);
  assert.equal(resetPasswordIssue("short", "short"), "Use a password with at least 8 characters.");
  assert.equal(resetPasswordIssue("long-enough", "different"), "Those passwords do not match.");
  assert.equal(resetPasswordIssue("long-enough", "long-enough"), null);
});
