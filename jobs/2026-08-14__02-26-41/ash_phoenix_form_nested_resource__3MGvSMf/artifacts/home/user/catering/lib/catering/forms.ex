defmodule Catering.Forms do
  @moduledoc """
  Facade that the LiveView layer uses to build, mutate, inspect and submit the
  nested catering order form.
  """

  @resource_fields %{
    Catering.Orders.Order => [:reference, :note],
    Catering.Orders.LineItem => [:dish, :quantity],
    Catering.Orders.Modifier => [:label, :surcharge_cents],
    Catering.Orders.Customer => [:name, :email],
    Catering.Orders.DeliveryWindow => [:label, :starts_at_minute, :ends_at_minute],
    Catering.Orders.CourierDrop => [:street, :postcode],
    Catering.Orders.CounterPickup => [:counter]
  }

  @doc """
  Returns a blank create form for the order graph.
  """
  @spec new_order_form() :: AshPhoenix.Form.t()
  def new_order_form do
    auto_forms = AshPhoenix.Form.Auto.auto(Catering.Orders.Order, :place)

    sorted_forms =
      [:customer, :delivery_windows, :fulfillment, :line_items]
      |> Enum.map(fn key -> {key, Keyword.get(auto_forms, key)} end)

    AshPhoenix.Form.for_create(Catering.Orders.Order, :place, as: "order", forms: sorted_forms)
  end

  @doc """
  Takes an order id and returns an update form for the stored order,
  including nested forms for its existing line items and their modifiers.
  """
  @spec edit_order_form(any()) :: AshPhoenix.Form.t()
  def edit_order_form(order_id) do
    order =
      Catering.Orders.Order
      |> Ash.get!(order_id)
      |> Ash.load!([
        line_items:
          Catering.Orders.LineItem
          |> Ash.Query.sort(position: :asc)
          |> Ash.Query.load(modifiers: Ash.Query.sort(Catering.Orders.Modifier, position: :asc))
      ])

    AshPhoenix.Form.for_update(order, :revise, as: "order")
  end

  @doc """
  Returns the %Phoenix.HTML.Form{} representation of a form.
  """
  @spec to_phoenix_form(AshPhoenix.Form.t()) :: Phoenix.HTML.Form.t()
  def to_phoenix_form(form) do
    Phoenix.HTML.FormData.to_form(form, [])
  end

  @doc """
  Revalidates a form against a fresh parameter map, with an optional keyword list of validation options.
  """
  @spec change(AshPhoenix.Form.t(), map(), keyword()) :: AshPhoenix.Form.t()
  def change(form, params, opts \\ []) do
    AshPhoenix.Form.validate(form, params, opts)
  end

  @doc """
  Adds a nested form at a path, with an optional keyword list of options.
  """
  @spec add_nested(AshPhoenix.Form.t(), String.t() | list(), keyword()) :: AshPhoenix.Form.t()
  def add_nested(form, path, opts \\ []) do
    AshPhoenix.Form.add_form(form, path, opts)
  end

  @doc """
  Removes the nested form at a path.
  """
  @spec remove_nested(AshPhoenix.Form.t(), String.t() | list()) :: AshPhoenix.Form.t()
  def remove_nested(form, path) do
    AshPhoenix.Form.remove_form(form, path)
  end

  @doc """
  Reorders the nested list at a path, given the new ordering as a list of the current zero-based indices.
  """
  @spec reorder(AshPhoenix.Form.t(), String.t() | list(), list()) :: AshPhoenix.Form.t()
  def reorder(form, path, order) do
    parsed_path = parse_path!(form, path)

    form
    |> AshPhoenix.Form.sort_forms(parsed_path, order)
    |> touch_path(parsed_path)
  end

  @doc """
  Moves the single nested form at a path one slot earlier (:up) or later (:down).
  """
  @spec move(AshPhoenix.Form.t(), String.t() | list(), :up | :down) :: AshPhoenix.Form.t()
  def move(form, path, direction) do
    parsed_path = parse_path!(form, path)
    list_path = Enum.drop(parsed_path, -1)

    instruction =
      case direction do
        :up -> :decrement
        :down -> :increment
      end

    form
    |> AshPhoenix.Form.sort_forms(parsed_path, instruction)
    |> touch_path(list_path)
  end

  @doc """
  Returns the parameter map that would be sent to the underlying action.
  """
  @spec submitted_params(AshPhoenix.Form.t()) :: map()
  def submitted_params(form) do
    AshPhoenix.Form.params(form)
  end

  @doc """
  Returns the hidden inputs required to render the form at a path.
  """
  @spec hidden_inputs(AshPhoenix.Form.t(), String.t() | list()) :: map()
  def hidden_inputs(form, path) do
    case AshPhoenix.Form.get_form(form, path) do
      nil ->
        %{}

      subform ->
        subform
        |> AshPhoenix.Form.hidden_fields()
        |> Map.new(fn {k, v} -> {to_string(k), to_string(v)} end)
    end
  end

  @doc """
  Returns the user-facing errors of the whole form tree.
  """
  @spec error_map(AshPhoenix.Form.t()) :: %{String.t() => list(list(String.t()))}
  def error_map(form) do
    form
    |> AshPhoenix.Form.errors(for_path: :all)
    |> Enum.reduce(%{}, fn {path, errors}, acc ->
      case AshPhoenix.Form.get_form(form, path) do
        nil ->
          acc

        subform ->
          formatted_errors =
            errors
            |> Enum.map(fn {field, message} -> [to_string(field), to_string(message)] end)
            |> Enum.sort()

          if Enum.empty?(formatted_errors) do
            acc
          else
            Map.put(acc, subform.name, formatted_errors)
          end
      end
    end)
  end

  @doc """
  Returns the untranslated errors of the form at a path.
  """
  @spec raw_error_list(AshPhoenix.Form.t(), String.t() | list()) :: list()
  def raw_error_list(form, path) do
    parsed_path = parse_path!(form, path)

    form
    |> AshPhoenix.Form.raw_errors(for_path: parsed_path)
    |> Enum.flat_map(&normalize_form_error/1)
    |> Enum.sort_by(fn {field, message, _vars} -> {field, message} end)
  end

  @doc """
  Returns a deterministic, plain-data snapshot of the whole form tree.
  """
  @spec serialize(AshPhoenix.Form.t()) :: map()
  def serialize(form) do
    serialize_form(form)
  end

  @doc """
  Submits the form and persists the whole graph.
  """
  @spec save(AshPhoenix.Form.t(), map() | nil) :: {:ok, any()} | {:error, AshPhoenix.Form.t()}
  def save(form, params \\ nil) do
    submit_opts = if is_nil(params), do: [params: nil], else: [params: params]

    case AshPhoenix.Form.submit(form, submit_opts) do
      {:ok, order} ->
        loaded_order =
          Catering.Orders.Order
          |> Ash.get!(order.id)
          |> Ash.load!([
            :customer,
            line_items:
              Catering.Orders.LineItem
              |> Ash.Query.sort(position: :asc)
              |> Ash.Query.load(modifiers: Ash.Query.sort(Catering.Orders.Modifier, position: :asc))
          ])

        {:ok, loaded_order}

      {:error, form} ->
        {:error, form}
    end
  end

  # Helpers

  defp parse_path!(form, path) do
    AshPhoenix.Form.parse_path!(form, path)
  end

  defp touch_path(form, parsed_path) do
    case Enum.split(parsed_path, -1) do
      {parent_path, [field]} ->
        if parent_path == [] do
          %{form | touched_forms: MapSet.put(form.touched_forms, to_string(field))}
        else
          AshPhoenix.Form.update_form(form, parent_path, fn p_form ->
            %{p_form | touched_forms: MapSet.put(p_form.touched_forms, to_string(field))}
          end)
        end

      _ ->
        form
    end
  end

  defp normalize_form_error(error) do
    case AshPhoenix.FormData.Error.to_form_error(error) do
      list when is_list(list) ->
        if Enum.all?(list, &is_tuple/1) and Enum.all?(list, &(tuple_size(&1) == 3)) do
          list
        else
          [list]
        end

      {_field, _msg, _vars} = tuple ->
        [tuple]

      other ->
        List.wrap(other)
    end
  end

  defp serialize_form(form) do
    hidden =
      form
      |> AshPhoenix.Form.hidden_fields()
      |> Map.new(fn {k, v} -> {to_string(k), to_string(v)} end)
      |> Map.delete("_touched")

    fields = Map.get(@resource_fields, form.resource, [])

    values =
      Map.new(fields, fn field ->
        val = AshPhoenix.Form.value(form, field)
        val_str = if is_nil(val), do: nil, else: to_string(val)
        {to_string(field), val_str}
      end)

    errors =
      form
      |> AshPhoenix.Form.errors()
      |> Enum.map(fn {field, message} -> [to_string(field), to_string(message)] end)
      |> Enum.sort()

    nested =
      form.form_keys
      |> Keyword.keys()
      |> Map.new(fn key ->
        config = form.form_keys[key]
        type = config[:type] || :single
        val = Map.get(form.forms, key)

        serialized_val =
          case type do
            :single ->
              if is_nil(val), do: nil, else: serialize_form(val)

            :list ->
              if is_nil(val), do: nil, else: Enum.map(val, &serialize_form/1)
          end

        {to_string(key), serialized_val}
      end)

    %{
      "name" => form.name,
      "id" => form.id,
      "type" => to_string(form.type),
      "resource" => inspect(form.resource),
      "valid" => form.valid?,
      "hidden" => hidden,
      "values" => values,
      "errors" => errors,
      "nested" => nested
    }
  end
end
