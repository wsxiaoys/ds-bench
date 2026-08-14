defmodule SlaLab.Ops.Validations.RatioWithin do
  use Ash.Resource.Validation
  alias Ash.Error.Changes.InvalidAttribute
  import Ash.Expr

  @impl true
  def init(opts) do
    {:ok, opts}
  end

  @impl true
  def validate(changeset, opts, _context) do
    actual_hours = Ash.Changeset.get_attribute(changeset, :actual_hours)
    promised_hours = Ash.Changeset.get_attribute(changeset, :promised_hours)
    max_bps = opts[:max_bps] || 15_000

    ratio = SlaLab.Expressions.RatioBps.ratio_bps(actual_hours, promised_hours)

    if ratio && ratio > max_bps do
      {:error,
       [
         field: :actual_hours,
         value: actual_hours,
         message: "delivery ratio exceeds the allowed maximum"
       ]
       |> InvalidAttribute.exception()}
    else
      :ok
    end
  end

  @impl true
  def atomic(_changeset, opts, context) do
    max_bps = opts[:max_bps] || 15_000
    
    condition = expr(ratio_bps(^atomic_ref(:actual_hours), ^atomic_ref(:promised_hours)) > ^max_bps)
    
    error = expr(
      error(^InvalidAttribute, %{
        field: :actual_hours,
        value: ^atomic_ref(:actual_hours),
        message: ^(context.message || "delivery ratio exceeds the allowed maximum"),
        vars: %{field: :actual_hours}
      })
    )
    
    {:atomic, [:actual_hours], condition, error}
  end

  @impl true
  def describe(opts) do
    [
      message: "delivery ratio exceeds the allowed maximum",
      vars: [field: :actual_hours, max_bps: opts[:max_bps]]
    ]
  end
end
