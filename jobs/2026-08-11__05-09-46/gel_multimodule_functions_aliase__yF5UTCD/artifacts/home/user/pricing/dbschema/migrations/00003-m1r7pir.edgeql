CREATE MIGRATION m1r7pir6swwkfe3csdvpu4jhjrei2pcsp3hejw2ysdz6mcasqo6uia
    ONTO m1ituluyhechuf4aorwgfed47rl5674foxlmcrjfrskwhttzygxxca
{
  CREATE MODULE reports IF NOT EXISTS;
  CREATE ALIAS reports::CustomerBalance := (
      SELECT
          billing::Customer {
              outstanding := billing::customer_outstanding(.name)
          }
  );
  CREATE ALIAS reports::InvoicePlan := (
      SELECT
          billing::Invoice {
              plan := util::installments(.total_due, .installment_count)
          }
  );
  CREATE ALIAS reports::UnpaidInvoice := (
      SELECT
          billing::Invoice
      FILTER
          NOT (.paid)
  );
};
