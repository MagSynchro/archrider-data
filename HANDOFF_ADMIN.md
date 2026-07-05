# HANDOFF: Admin/Moderator Staff Accounts

Design context for the Admin/Moderator system: `staff_accounts` (migration
019), `staff_actions` audit log, `adminController.js`/`adminRoutes.js`,
and the `/staff` frontend portal.

## Why a wholly separate entity from `users`

An earlier pass (migration 018) put a `role` column directly on `users`.
That was wrong for two reasons, both raised before building the real
feature set:

- **Semantic overload.** `users.archidekt_username`/`archidekt_user_id`
  mean "a verified real Archidekt account" everywhere else in the
  codebase. Storing synthetic staff identities in the same table would
  overload that meaning.
- **Real production shape.** Staff/admin identity is a different kind of
  account with a different lifecycle (admin-provisioned, not
  self-registered; hard-deletable; never linked to Archidekt) from a
  consumer account. Modeling it as a separate table matches how this is
  usually done in practice, not just a local convenience.

`users.role` was removed outright (not left as a vestige) once
`staff_accounts` existed -- a real Archidekt-linked user can never be
staff under this model, so keeping a column that could only ever read
`'user'` would just be confusing dead weight.

## Owner: a fourth tier added after a takeover-risk review

Shortly after the initial Admin/Moderator build, a real gap was flagged:
Admin accounts could create *and delete* other Admin accounts. That's a
system-takeover vector -- a compromised or rogue Admin session could
delete every other Admin and mint itself a fresh one, or simply purge
the competition. Migration 020 adds an **Owner** role to close this:

- **Admin** retains every prior capability except acting on *other Admin
  accounts*. Admin can still create/delete Moderator accounts, ban/unban
  users, delete decks, add credits, sync/probe for a user, reset a
  regular user's password, and view the audit log.
- **Owner** has every Admin capability, plus the two Admin-account
  powers Admin lost (create Admin, delete Admin), plus a new power
  Admin never had (reset an Admin or Moderator's own password).
- **Moderator is untouched** by this change.

**Owner accounts themselves are never creatable or deletable through the
running app, by anyone, including another Owner** -- only a bootstrap/DB
script can do it (see the `Owner-Shane` account below, seeded the same
way `Admin-Shane`/`Mod-Shane` were). This is deliberate and symmetrical
with the whole reason Owner exists: if Owner-creation were reachable
through the API, a compromised Owner session could mint more Owners,
reintroducing the exact takeover risk this tier was added to close off.
Owner's own password also can't be reset via `resetStaffPassword` for
the same reason -- that endpoint explicitly excludes `role = 'owner'`
targets even though the caller is always an Owner.

Enforcement is split across two layers:
- Route-level (`requireAdminRole`/`requireOwnerRole`): gates who can
  *reach* an endpoint at all. `requireAdminRole` now accepts Admin or
  Owner (Owner inherits every Admin-level route); `requireOwnerRole` is
  the strict Owner-only gate (used only for
  `POST /api/admin/staff/:id/reset-password`).
- Controller-level (`adminController.createStaffAccount`/
  `deleteStaffAccount`): gates which *target role* the caller may act on,
  since that depends on the request body/target row, not just the
  caller's own role -- an Admin reaching `POST /api/admin/staff` is fine
  for a Moderator target, rejected for an Admin target, and a `role:
  'owner'` target is rejected outright regardless of caller.

The old "can't delete the last remaining Admin" guard was removed --
it's no longer a real lockout risk now that Owner always retains full
Admin-level capability independent of how many Admin accounts exist.

## staff_accounts

`username`, `email`, `password_hash`, `real_name`, `role`
(`admin`/`moderator`), `created_by` (nullable -- the bootstrap accounts
have no creating admin to attribute to). No `archidekt_username`,
`archidekt_user_id`, `tier`, or `credits` -- staff accounts don't
participate in the consumer tier/credit economy at all.

**Convention, enforced in `adminController.createStaffAccount`, not the
DB schema:** usernames must start with `Admin-` or `Mod-` matching their
role, so staff identity is recognizable at a glance anywhere it's logged
(the audit log especially).

**Hard delete, not soft-disable** -- explicit user decision. Guarded so
it can't be used to lock out the whole admin ecosystem: a staff account
can't delete itself, and the last remaining admin account can't be
deleted by anyone.

## Sessions: a separate cookie, not a new JWT `type` on the existing one

Staff auth uses its own cookie (`archrider_staff_session`, 12h expiry --
shorter than the consumer session's 7 days, since this is an elevated-
privilege session) and its own login endpoint (`POST /api/admin/login`),
entirely independent of the consumer session (`archrider_session`,
`requireAuth`/`requireSession`).

This matters concretely here: the bootstrap Admin account's email
(`moraff@gmail.com`) is the *same* email as the real, pre-existing
consumer Wayfarer account. Two separate cookies mean the same person can
be logged into their real consumer account and their staff account in
the same browser simultaneously, with neither login stomping the other.

`requireStaffAuth` re-reads the account fresh from `staff_accounts` on
**every request** -- it does not trust username/email/role cached in the
JWT. This is stricter than the consumer `requireAuth`'s tier-freshness
pattern (see HANDOFF_QUEUE.md) for a reason specific to staff: staff
accounts can be hard-deleted, so a token for an account that no longer
exists must stop working immediately, not linger until a natural expiry.

## Ban enforcement on the consumer side had to change too

Adding "ban users from platform" meant `users` needed a `banned_at`/
`ban_reason`. The interesting part isn't the columns -- it's that
`requireAuth` (consumer) previously never touched the DB at all, trusting
the JWT completely. A ban has to take effect *immediately*, not at the
end of a 7-day cookie's natural life, so `requireAuth` now does one
indexed lookup per authenticated request to check `banned_at`. At
Friends & Family scale this cost is negligible; it's flagged here because
it's a deliberate correctness-over-micro-optimization tradeoff, not an
oversight.

## Audit log: snapshots, not live joins

`staff_actions` stores `actor_username`/`actor_email`/`actor_role` as a
snapshot at the moment of the action, alongside `actor_staff_id` (`ON
DELETE SET NULL`). This is deliberate, not redundant with a join: staff
accounts are hard-deleted, and the explicit ask behind this table was
"retain a record of bad-actor emails that shouldn't be let back into the
admin ecosystem" -- a live join through `actor_staff_id` would lose that
information the moment the account is removed, which is exactly the
moment it starts to matter.

`target_type`/`target_id` are loosely typed (`target_id` is always
stored as text) since targets come from different tables with different
key shapes (user id, deck id, staff account id).

## Admin-only vs shared-with-Moderator vs Owner-only, and why the split lands where it does

Per the user's confirmed scope:

- **Admin + Owner:** view the audit log, add/remove credits, sync a
  user's decklist, probe a deck on a user's behalf, view/create/delete
  staff accounts (target-role-dependent, see above).
- **Shared (Admin + Moderator + Owner):** view users/decks, ban/unban,
  delete a deck, reset a regular user's password.
- **Owner only:** create/delete Admin accounts, reset an Admin or
  Moderator's own password.

Enforced with three middlewares layered in `adminRoutes.js`:
`requireStaffAuth` (any valid staff session) mounted on the whole router,
`requireAdminRole` (Admin or Owner) per-route for the admin-level subset,
and `requireOwnerRole` (Owner only) for the one strictly Owner-only route.

## Admin-initiated sync/probe: free, and always priority-lane

Admin "sync decklist for a user" / "probe deck for a user" are support
actions, not consumer actions -- they deliberately do **not** deduct
credits from anyone (unlike the consumer-facing
`syncMyDecks`/`probeDeck` in `scoutController.js`, which are
credit-gated). Keeping this free is what keeps "add credits" a distinct,
meaningful admin function: that one exists to *compensate/adjust* a
user's balance for a documented reason, and doesn't get entangled with
the mechanics of an unrelated support sync.

Both dispatch through `archidektThrottle.js` with an explicit `tier:
'staff'`, which `isPriorityTier()` now recognizes alongside the real paid
consumer tiers (`pathfinder`/`banneret`/`cartographer`) -- so staff
support actions always get priority-lane treatment regardless of the
target user's own tier, without staff needing a fake "tier" in the
consumer sense.

`addCredits` is deliberately **not** capped at `credits_max` the way the
normal refund path is (`src/utils/credits.js`) -- it's a manual override
outside the regen/spend economy, not a refund, and the whole point is to
be able to make a user whole regardless of their normal ceiling.

## Password reset: no email infra, so it's a direct reset

There's no outbound-email system in this project. `resetUserPassword`
generates a new passphrase, hashes and stores it directly, and returns
the plaintext once in the API response for the staff member to relay to
the user out-of-band -- mirroring exactly how the bootstrap accounts'
own credentials were delivered (see below). Nothing else in the system
ever sees or stores that plaintext.

## Passphrase format

`src/utils/passphrase.js` generates Diceware-style `word-word-word-##`
passphrases (three words from a small curated list + a 2-digit number),
per explicit request -- easy to read aloud/relay manually, easy to
rotate. Uses `crypto.randomInt` (CSPRNG), not `Math.random`, since these
back real credentials.

## Bootstrap accounts

`Admin-Shane` (moraff@gmail.com), `Mod-Shane`
(magsynchro@ctgstudios.net), and `Owner-Shane`
(convertibleturtlegaming@gmail.com) -- all real name "Shane Abernathy" --
were seeded by one-off scratchpad scripts (not checked into the repo).
The first two existed before the Owner tier was added, since there was
no admin yet to call the "create staff account" endpoint the first time;
`Owner-Shane` was added the same way once the Owner tier existed,
since Owner accounts are permanently bootstrap/DB-only (see above) --
there's no "create owner" endpoint to call even now. `created_by` is
`NULL` for all three. Their generated passphrases were delivered once,
directly in chat -- never written to any file in this repo.

## Explicitly deferred, not part of this pass

- No frontend confirmation-dialog component reuse for destructive staff
  actions (ban, delete deck, delete staff account, add credits) --
  `window.confirm`/`window.prompt` are used instead. This is an internal
  tool for a handful of trusted staff, not consumer-facing, so the
  native browser dialogs were judged sufficient rather than building out
  a second modal component to match `ConfirmDialog.jsx`'s consumer
  credit-spend UX.
- No pagination on `GET /api/admin/actions` (hard-capped at the most
  recent 200 rows) or filtering by actor/action -- revisit if the audit
  log grows large enough for that cap to matter in practice.
- No self-service "staff password change" flow -- only the bootstrap
  passphrases and admin-triggered consumer-user password resets exist
  right now. A staff member wanting to rotate their own password
  currently needs another admin to delete+recreate their account, or a
  direct DB update.
