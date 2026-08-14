defmodule SlaLab.Ops.Validations.RatioWithin do
  use Ash.Resource.Validation

  import Ash.Expr

  @impl true
  def init(opts) do
    if is_integer(opts[:max_bps]) do
      {:ok, opts}
    else
      {:error, "max_bps must be an integer"}
    end
  end

  @impl true
  def supports(_opts), do: [Ash.Changeset]

  @impl true
  def validate(changeset, opts, _context) do
    actual_hours = Ash.Changeset.get_attribute(changeset, :actual_hours)
    promised_hours = Ash.Changeset.get_attribute(changeset, :promised_hours)

    ratio = SlaLab.Expressions.RatioBps.ratio_bps(actual_hours, promised_hours)

    if is_nil(ratio) or ratio <= opts[:max_bps] do
      :ok
    else
      {:error,
       Ash.Error.Changes.InvalidAttribute.exception(
         field: :actual_hours,
         value: actual_hours,
         message: "delivery ratio exceeds the allowed maximum"
       )}
    end
  end

  @impl true
  def atomic(_changeset, opts, _context) do
    {:atomic,
     [:actual_hours],
     expr(ratio_bps(^atomic_ref(:actual_hours), promised_hours) > ^opts[:max_bps]),
     expr(
       error(^Ash.Error.Changes.InvalidAttribute, %{
         field: :actual_hours,
         value: ^atomic_ref(:actual_hours),
         message: ^"delivery ratio exceeds the allowed maximum",
         vars: %{field: :actual_hours}
       })
     )}
  end
end
