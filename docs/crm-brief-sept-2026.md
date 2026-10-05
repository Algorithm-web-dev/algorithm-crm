# CRM Refinements — Response to Development Brief (2 Sept 2026)

Response to Jamie's brief *"CRM Refinements: Stage Workflow, Deal Ownership, Alerts & Data Export"*.
Each section answers the brief's questions, says what has been built, and lists the decisions still needed from Jamie / Simon.

| # | Item | Status |
|---|------|--------|
| 1 | Deal stage move blocked by Company field | **Fixed**: root cause below |
| 2 | Deal owner field | **Built**: backfill approach needs confirming |
| 3 | Stage probability config file | **Built**: percentages need sign-off |
| 4 | Deal stage alerts | **Built**: cadence per stage needs agreeing |
| 5 | Data export for the finance tracker | **Built** |
| 6 | BCC email capture | Feasibility note only (no build) |

---

## 1. Priority fix: deal stage move blocked by Company field

### Root cause
This was a validation problem, not missing data.

1. **"MyBritishPassport" never had a company record.** Deals created in *Inbox* or *Qualifying* only store a typed-in "prospect company name". A real Company record is only created when a deal is *promoted* (dragged) into Discovery or later. MyBritishPassport was still in Qualifying, so there was nothing to find in the dropdown. It wasn't filtered out, misspelled or archived. It didn't exist.
2. **The Lost column on the board didn't accept drops.** So the only way to mark a deal as Lost was the Edit Deal form.
3. **The Edit Deal form treated Lost like an active late-stage deal.** Picking "Lost" switched the form into "linked records" mode, which made Company mandatory. This blocked every early-stage lead from being closed as Lost. Two more problems came with it: the form skipped the loss reason, and it would have erased the prospect details on save.

The same block applied to **any** early-stage lead moved to Lost, and to any later-stage deal whose company had been deleted.

### What was changed
- **Company is no longer required to mark a deal Lost.** Leads keep their prospect details, and the form asks for a loss reason instead.
- **You can now drag deals onto the Lost column.** It opens the usual "Mark as Lost" box. Previously, dragging a lead there would have asked you to create a contact and company first.
- **"+ Create new company…"** is now an option in the Company dropdown. It's pre-filled with the prospect's company name, for the cases where a company genuinely is needed.
- Company is **still required** for active late stages (Discovery → Verbal, and Won). That keeps qualified pipeline data clean. **→ Jamie: please confirm you're happy with this rule.**
- Stage changes made through the Edit Deal form now also appear in the deal's activity history. Re-opening a Lost deal clears its loss reason.

### Checking how many other deals are affected
Run this in Supabase → SQL Editor. It shows every deal without a linked company, grouped by stage:

```sql
select deal_stage, count(*) as deals_without_company
from deals where company_id is null
group by deal_stage order by deal_stage;
```

Everything in *inbox* / *qualifying* is normal. Any deal in *discovery* → *won* on this list has a missing company. It can now be fixed from the form with "+ Create new company…". To list them:

```sql
select name, deal_stage, lead_company_name, created_at
from deals
where company_id is null and deal_stage not in ('inbox', 'qualifying', 'lost')
order by created_at;
```

---

## 2. Deal owner field

**Did it already exist?** Partly. Each deal has an `owner_id`, but that is just *who created it*. It can't be changed and wasn't shown anywhere. Since the move to a shared team workspace, it no longer controls anything either.

**What was built**
- A new **Deal owner** field (`deal_owner_id`) that points to a real CRM user, not free text.
- It's **required**, and it's a dropdown on the New/Edit Deal form. It defaults to the person creating the deal.
- The owner's initials show on every deal card, and hovering shows their full name.
- The owner's name is included in every alert (Section 4) and in the export (Section 5).
- A user who still owns deals can't be deleted until their deals are reassigned. This stops deals from ending up with no owner.

**Backfill.** Existing deals were automatically given **their creator as the owner**. Individual deals can be reassigned from the Edit Deal form.
**→ Jamie: please confirm this is OK.** If you'd rather bulk-assign (e.g. "all Proposal deals → Simon"), send me the rules and I'll run a one-off update.

---

## 3. Stage probability configuration

**Current stages and probabilities.** These are the values that were previously hard-coded, now moved into the config file. **They have not been reviewed yet.**

| Stage | Probability |
|---|---|
| Inbox | 5% |
| Qualifying | 15% |
| Discovery | 25% |
| Proposal | 45% |
| Negotiation | 65% |
| Verbal | 85% |
| Won | 100% |
| Lost | 0% |

**→ Jamie / Simon: please confirm or send the agreed percentage for each stage.**

**Where it lives:** `config/stage-probabilities.json` in the code repository. It's a short, readable file with one number per stage. The current values are also shown read-only on the **Automations** page in the CRM, so anyone can check them.

**How to change it**
1. Send the new numbers to the developer (Ashlin).
2. They edit the file and fill in `lastReviewed` / `reviewedBy`, then push it.
3. Vercel redeploys automatically, and the new numbers are live in about 2 minutes.

No code change is needed. If someone enters an invalid value (e.g. 150%, or a missing stage), the deploy is **rejected**, so the live CRM can't pick up a bad number.

These numbers feed: the "Weighted" pipeline figure on the Deals page, the finance export, and the Automations page.

---

## 4. Deal stage alerts

**What existed before.** Each user had their own "stalled deal" settings, and the alert only went to the deal's creator. It **never actually reached anyone.** It only printed to a server log.

**What was built** (Automations page). These are now **team-wide settings**, with two options for each stage:
- **Stalled after N days**: alert everyone when a deal has sat in that stage for N days without moving. This is checked daily at 09:00 UTC and fires once per stage visit. Moving the deal resets the timer.
- **On entry**: alert everyone the moment a deal moves into that stage (e.g. "a deal just reached Verbal" or "a deal was Won").

**Every alert goes to all CRM users** and includes the owner snippet, e.g.:

> **MyBritishPassport has been in Qualifying for 9 days**
> Deal owner: Simon Lloyd

**Delivery**
- **Google Chat (the main channel):** alerts are posted to the **CRM directors' Google Chat space**.
  - "On entry" alerts post the moment the deal moves.
  - Stalled deals post as one combined message each morning, so the space isn't flooded.
  - Each message names the deal owner and has an "Open in CRM" link.
  - Setup takes about 5 minutes (see Go-live, step 4). The Automations page shows whether it's connected and has a "Send test message" button.
- **In-app (live now):** a new **Notifications** page with an unread count in the sidebar. Clicking an alert opens that deal.
- **Email (built, off by default):** an optional daily digest email. It's no longer needed now that Google Chat is the channel. It stays off unless an email sender is set up.

**→ Jamie: please send the cadence you want for each stage.** For each stage, give a "stalled after N days" number and say whether you want "on entry" alerts. Also confirm the Google Chat space to use. For now the stalled thresholds carry over the old defaults (Inbox 1, Qualifying 3, Discovery 7, Proposal 7, Negotiation 5, Verbal 3 days), and all "on entry" alerts are off. Anyone in the team can change these on the Automations page. No developer is needed.

---

## 5. Data export for the finance tracker

**Recommendation:** an **"Export CSV" button** on the Deals page. One click downloads a spreadsheet that opens directly in Excel, which is the most accessible option for a non-technical finance user. For a tracker that refreshes itself, the same data is also available at a secure link (below).

**Columns:** Deal ID, Deal Name, Stage, **Deal Owner**, Deal Owner Email, Currency, Monthly Value, One-off Value, **Deal Value**, **Probability (%)**, Expected Close Date, Last Updated.

- **Deal Value** = 12 × monthly value + one-off value. This is the same figure shown on the deal cards. The monthly and one-off amounts are also included separately, in case finance wants to calculate it differently.
- **Probability** comes straight from the Section 3 config file.
- There are no totals, weighting or reporting. The export only surfaces raw data, as the brief asked.
- The **Deal ID** column lets the finance tracker match rows between exports, even when a deal is renamed.

**Automatic refresh in Excel (optional).** Once an `EXPORT_API_KEY` is set up (Go-live, step 5), finance can use Excel → *Data* → *From Web* with this link:
`https://<crm-address>/api/export/deals?key=<EXPORT_API_KEY>`
Excel can then refresh the data with one click. Treat that link like a password. If it leaks, change the key in Vercel and the old link stops working.
Filters: add `&status=open` (active deals only), `won`, or `lost`. Add `&format=json` for other tools.

---

## 6. Future: email capture on deal records (feasibility note)

**Feasible, medium complexity. Roughly 1–2 weeks of build.**

- **How it would work.** A dedicated address (e.g. `deals@crm.algorithm.agency`) goes on BCC. An inbound-email service (Postmark, Resend Inbound, SendGrid Inbound Parse or Mailgun) receives the email and forwards it to the CRM. The CRM then attaches it to the deal's activity timeline. The database already has an "email" activity type, so no redesign is needed.
- **The hard part is matching an email to the right deal.** Matching on the recipient's email address against Contacts works when the contact has exactly one open deal. People at the same company with several deals are ambiguous. Common fixes:
  - a per-deal address, e.g. `deals+<deal-code>@…`, or
  - an "Unmatched emails" inbox where someone assigns the email by hand.
- **Other considerations:**
  - attachments need file storage (Supabase Storage is fine),
  - replies drop off unless people keep BCC'ing,
  - a policy on storing client emails (POPIA / GDPR).
- **Notifications:** each captured email, and each email that can't be matched to a deal, would post to the same **CRM directors' Google Chat space** as the deal alerts. That channel is now built and ready to reuse.
- **Alternative:** the Gmail sync already on the roadmap (Phase 3) would capture emails automatically, with no BCC habit needed. But it takes more setup, because Google must approve the app.

---

## Follow-up: closed deals, director deletes, richer Lost alerts

Agreed with Ashlin after go-live:

- **Opening a Won or Lost deal** shows a read-only summary: owner, loss reason, company, contact, value and close date. Changes are now deliberate actions:
  - **Edit** (Won and Lost): opens the full form, for corrections.
  - **Reopen** (Lost): choose the stage to reopen into. A deal with no company can only reopen as a lead (Inbox or Qualifying).
  - **Delete** (Lost, **directors only**): permanent. You confirm by typing the deal name. Directors also get a Delete button on the Lost page.
- **Who is a director** is set in Supabase. Users can't make themselves directors, and the database itself blocks deletes by anyone else:
  ```sql
  update profiles set is_director = true
  where email in ('jamie@algorithm.agency', 'simon@algorithm.agency');
  ```
- **Deleting a deal alerts everyone**, in-app and in Google Chat: "🗑️ *Deal* was deleted by Jamie · Deal owner: … · Was in: Lost".
- **Lost alerts include the reason**: "🔴 *Deal* moved to Lost · Deal owner: Ashlin · Reason: Price". Won alerts use 🏆.

Run `supabase/migrations/006_directors_delete_and_lost_reason.sql` **before** deploying this change, then mark the directors.

## Go-live steps (for the developer)

Follow this order. The database change is compatible with the version currently live, so running it first is safe.

1. **Database:** in Supabase → SQL Editor, run `supabase/migrations/003_owner_alerts_notifications.sql`. It's safe to run twice.
2. **Deploy:** merge the branch. Vercel deploys automatically.
   Then run `supabase/migrations/004_google_chat_alerts.sql`. It turns on Supabase's `pg_net` extension, which the database uses to post to Google Chat. Then run `supabase/migrations/005_fix_google_chat_content_type.sql`, a one-function fix: without it, posts from the database to Google Chat are silently dropped.
3. **Check:**
   - mark a Qualifying test deal as Lost, both by dragging it and through Edit Deal,
   - check that the Deal owner dropdown lists everyone,
   - click Export CSV,
   - switch on an "On entry" alert and move a deal to confirm a notification appears.
4. **Connect Google Chat:**
   - In the directors' space in Google Chat, open *Apps & integrations* → *Webhooks* → *Add webhook*, name it "Algorithm CRM", and copy the URL. Adding webhooks needs a Google Workspace account, and the Workspace admin must allow incoming webhooks.
   - In Supabase → SQL Editor, run:
     ```sql
     insert into integration_settings (key, value) values
       ('google_chat_webhook_url', '<paste webhook URL>'),
       ('app_url', 'https://<crm-address>')
     on conflict (key) do update set value = excluded.value, updated_at = now();
     ```
   - On the Automations page, click **Send test message**.
   - Treat the webhook URL like a password: anyone who has it can post into the space. If it leaks, delete the webhook in Google Chat, create a new one and re-run the SQL.
5. **Email alerts (optional, not needed if Google Chat is used):**
   - create a Resend account and verify the sending domain,
   - in Vercel, set `RESEND_API_KEY`, `ALERT_EMAIL_FROM` (e.g. `CRM Alerts <crm@algorithm.agency>`) and `NEXT_PUBLIC_APP_URL`,
   - redeploy.
6. **Finance live link (optional):** set `EXPORT_API_KEY` in Vercel (`openssl rand -base64 32`), redeploy, and send the link to finance privately.

## Decisions needed from Jamie / Simon

1. Keep Company required for Discovery → Won (it's no longer required for Lost)?
2. Deal owner backfill: is "creator becomes owner" OK, or should some deals be bulk-reassigned?
3. Agreed close probability % for each stage.
4. Alert cadence for each stage (stalled-after days, and on-entry yes/no), and which Google Chat space the alerts go to.
5. Export: is the CSV button enough for finance, or do they also want the auto-refreshing Excel link?
