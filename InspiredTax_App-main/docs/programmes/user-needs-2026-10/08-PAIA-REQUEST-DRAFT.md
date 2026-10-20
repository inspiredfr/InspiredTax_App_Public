# 08 — PAIA request draft: provisional tax penalty statistics

**Status:** draft for the owner to review and send. Nothing has been sent.
Fill in the bracketed fields. Confirm the current form, address and any fee
in the SARS PAIA manual on sars.gov.za before sending. Do not put any personal
tax details in the request; this asks only for aggregate statistics.

## Why

`04-MARKET-EVIDENCE.md` §3: SARS publishes no count or rand value of
provisional-tax penalties for individuals. Tax Statistics 2024 and the Annual
Report summaries were searched. A number would move the validation rubric's
"pain exists" from yellow to green.

## Limits to expect

- PAIA gives access to **records that exist**. It does not oblige SARS to
  compile new statistics. The request therefore asks for existing reports or
  system extracts and accepts any format.
- SARS may refuse on confidentiality grounds under the Tax Administration
  Act. Aggregate counts shouldn't identify anyone, but expect the possibility.
- Statutory timeline: 30 days, extendable by 30.

## Request text

> **To:** The Information Officer / Deputy Information Officer, South African
> Revenue Service [address per the SARS PAIA manual]
>
> **Request for access to records of a public body (PAIA, section 18)**
>
> **Requester:** [full name], [capacity, e.g. developer of a personal income
> tax planning application], [postal or e-mail address for the reply]
>
> **Records requested.** Any existing report, statistical table, management
> report or system extract held by SARS that shows, for **individual**
> (natural person) taxpayers, for each year of assessment from 2019 to 2025:
>
> 1. the number of penalties imposed under paragraph 20 of the Fourth
>    Schedule to the Income Tax Act (underestimation of provisional tax), and
>    their total rand value;
> 2. the number of late-payment penalties imposed under section 213 of the
>    Tax Administration Act read with the provisional tax provisions (late
>    first or second provisional payments), and their total rand value;
> 3. the total interest charged under section 89bis/89quat of the Income Tax
>    Act on late or underpaid provisional tax;
> 4. the number of such penalties remitted or reduced on request.
>
> Aggregate figures only. I do not ask for any information identifying a
> taxpayer. If the records exist only for all provisional taxpayers combined
> (individuals, trusts and companies), please provide those, stating the
> scope. If only part of this exists, please provide that part.
>
> **Form of access:** electronic copy (spreadsheet or PDF) by e-mail.
>
> **Purpose:** to understand how often individual provisional taxpayers are
> penalised for under-estimating or paying late, so that planning tools can
> help taxpayers meet their obligations.
>
> [signature] · [date]

## After sending

Log the date sent and SARS's reference in `04-MARKET-EVIDENCE.md` §3. Put
the reply's figures there with the reference, and update
`.sweetclaude/state/discovery.yaml` `validation_rubric.pain_exists`.
