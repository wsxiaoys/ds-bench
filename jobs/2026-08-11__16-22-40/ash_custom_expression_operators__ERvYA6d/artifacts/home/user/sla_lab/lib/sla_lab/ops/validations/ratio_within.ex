defmodule SlaLab.Ops.Validations.RatioWithin do
  use Ash.Resource.Validation
  import Ash.Expr

  @opt_schema [
    max_bps: [
      type: :integer,
      required: true,
      doc: "The maximum basis points allowed"
    ]
  ]

  def opt_schema, do: @opt_schema

  opt_schema = @opt_schema

  defmodule Opts do
    use Spark.Options.Validator, schema: opt_schema
  end

  @impl true
  def init(opts) do
    case Opts.validate(opts) do
      {:ok, opts} ->
        {:ok, Opts.to_options(opts)}

      {:error, error} ->
        {:error, Exception.message(error)}
    end
  end

  @impl true
  def supports(_), do: [Ash.Changeset]

  @impl true
  def validate(changeset, opts, _context) do
    actual_hours = Ash.Changeset.get_attribute(changeset, :actual_hours)
    promised_hours = Ash.Changeset.get_attribute(changeset, :promised_hours) || changeset.data.promised_hours

    ratio = SlaLab.Expressions.RatioBps.ratio_bps(actual_hours, promised_hours)

    if ratio && ratio > opts[:max_bps] do
      {:error, Ash.Error.Changes.InvalidAttribute.exception(
        field: :actual_hours,
        message: "delivery ratio exceeds the allowed maximum"
      )}
    else
      :ok
    end
  end

  @impl true
  def atomic(_changeset, opts, _context) do
    {:atomic, [:actual_hours],
     expr(ratio_bps(^atomic_ref(:actual_hours), promised_hours) > ^opts[:max_bps]),
     expr(
       error(^Ash.Error.Changes.InvalidAttribute, %{
         field: :actual_hours,
         message: "delivery ratio exceeds the allowed maximum"
       })
     )}
  end
end
