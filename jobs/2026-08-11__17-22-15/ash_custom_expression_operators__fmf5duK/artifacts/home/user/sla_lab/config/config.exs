import Config

config :sla_lab, ash_domains: [SlaLab.Ops]

config :logger, level: :warning

config :ash, :custom_expressions, [
  SlaLab.Expressions.RouteKey,
  SlaLab.Expressions.RatioBps
]
