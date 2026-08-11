CREATE MIGRATION m1uwkclxqsyrrqpmcym7rt6r6brf25fjwgoy5nxjloiosni7mvtfxa
    ONTO initial
{
  CREATE MODULE util IF NOT EXISTS;
  CREATE FUNCTION util::apply_discount(amount: std::decimal, pct: std::decimal, floor_amount: OPTIONAL std::decimal) ->  std::decimal USING (WITH
      d := 
          std::round((amount * (1.0n - (pct / 100.0n))), 2)
  SELECT
      (IF EXISTS (floor_amount) THEN (IF (d > std::assert_exists(floor_amount)) THEN d ELSE std::assert_exists(floor_amount)) ELSE d)
  );
  CREATE FUNCTION util::gross_with_tax(net: std::decimal, NAMED ONLY tax_pct: std::decimal = 0) ->  std::decimal USING (std::round((net * (1.0n + (tax_pct / 100.0n))), 2));
  CREATE FUNCTION util::installments(total: std::decimal, count: std::int64) -> SET OF std::decimal USING ((IF (count < 1) THEN <std::decimal>{} ELSE (WITH
      each_installment := 
          std::round((total / (IF (count < 1) THEN 1 ELSE count)), 2)
      ,
      i := 
          std::range_unpack(std::range(1, (IF (count < 1) THEN 1 ELSE (count + 1))))
  SELECT
      (IF (i < count) THEN each_installment ELSE (total - ((count - 1) * each_installment)))
  )));
  CREATE FUNCTION util::money_round(amount: std::decimal) ->  std::decimal USING (std::round(amount, 2));
  CREATE FUNCTION util::money_round(amount: std::decimal, places: std::int64) ->  std::decimal USING (std::round(amount, places));
  CREATE FUNCTION util::total_of(VARIADIC amounts: std::decimal) ->  std::decimal USING (std::round(std::sum(std::array_unpack(amounts)), 2));
};
