# Sale completion handoff

After a sale is saved from the Sales page, the entry form becomes a completion state instead of silently resetting. It confirms the saved sale, shows total/paid/balance, and offers the next useful action: open the sale for payment or delivery follow-up, download the invoice, view sales history, or start another sale. The saved API response is returned through the page handler so the completion state can link to the real record and use server totals.

The completion state keeps the existing draft cleanup and failed-save retention behavior. The global sale modal still closes after a successful save and refreshes the surrounding workspace; its next-step handoff remains the sale page completion state when the user starts from `/sales`.

Validation: eight SaleForm tests pass and the production build compiles. Browser verification of the completion actions on mobile remains pending.
