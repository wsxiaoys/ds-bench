defmodule SlaLab.Ops.Validations.RatioWithin do
  use Ash.Resource.Validation

  @impl true
  def init(opts) do
    if is_integer(opts[:max_bps]) do
      {:ok, opts}
    else
      {:error, "max_bps must be an integer!"}
    end
  end

  @impl true
  def validate(changeset, opts, _context) do
    actual_hours = Ash.Changeset.get_attribute(changeset, :actual_hours)
    promised_hours = Ash.Changeset.get_attribute(changeset, :promised_hours) || changeset.data.promised_hours

    if is_nil(actual_hours) or is_nil(promised_hours) or promised_hours == 0 do
      :ok
    else
      ratio = SlaLab.Expressions.RatioBps.ratio_bps(actual_hours, promised_hours)
      if ratio && ratio > opts[:max_bps] do
        {:error,
         Ash.Error.Changes.InvalidAttribute.exception(
           field: :actual_hours,
           value: actual_hours,
           message: "delivery ratio exceeds the allowed maximum"
         )}
      else
        :ok
      end
    end
  end

  @impl true
  def atomic(_changeset, opts, _context) do
    {:atomic,
      [:actual_hours],
      expr(ratio_bps(^atomic_ref(:actual_hours), ^atomic_ref(:promised_hours)) > ^opts[:max_bps]),
      expr(
        error(^Ash.Error.Changes.InvalidAttribute, %{
          field: :actual_hours,
          value: ^atomic_ref(:actual_hours),
          message: "delivery ratio exceeds the allowed maximum",
          vars: %{field: :actual_hours}
        })
      )
    }
  end
end
