defmodule Catalog.Library.Book do
  use Ash.Resource,
    otp_app: :catalog,
    domain: Catalog.Library,
    data_layer: Ash.DataLayer.Ets,
    extensions: [AshJsonApi.Resource],
    authorizers: [Ash.Policy.Authorizer]

  json_api do
    type "book"
    includes [:author, :reviews]
  end

  attributes do
    uuid_primary_key :id

    attribute :title, :string do
      allow_nil? false
      public? true
      constraints [min_length: 1]
    end

    attribute :shelf, :string do
      allow_nil? false
      public? true
      constraints [min_length: 1]
    end

    attribute :year, :integer do
      allow_nil? false
      public? true
      constraints [min: 1450, max: 2100]
    end

    attribute :price_cents, :integer do
      allow_nil? false
      public? true
      constraints [min: 0]
    end

    attribute :restricted, :boolean do
      allow_nil? false
      public? true
      default false
    end
  end

  relationships do
    belongs_to :author, Catalog.Library.Author do
      allow_nil? false
      public? true
      attribute_public? false
      attribute_writable? true
    end

    has_many :reviews, Catalog.Library.Review do
      public? true
    end
  end

  actions do
    defaults [:destroy]

    read :read do
      primary? true
      pagination do
        offset? true
        default_limit 10
        max_page_size 250
        countable true
      end
    end

    create :create do
      accept [:title, :shelf, :year, :price_cents, :restricted]
      argument :author, :uuid, allow_nil?: false
      change manage_relationship(:author, :author, type: :append_and_remove)
    end

    update :update do
      accept [:title, :shelf, :year, :price_cents, :restricted]
    end

    action :shelf_summary, :map do
      argument :shelf, :string, allow_nil?: false

      run fn input, _context ->
        require Ash.Query
        query =
          Catalog.Library.Book
          |> Ash.Query.filter(shelf == ^input.arguments.shelf)
          |> Ash.Query.load([:reviews])

        books =
          case Ash.read(query, authorize?: false) do
            {:ok, %{results: results}} -> results
            {:ok, list} when is_list(list) -> list
            _ -> []
          end

        book_count = Enum.count(books)
        review_count = Enum.sum(Enum.map(books, &Enum.count(&1.reviews)))
        total_price_cents = Enum.sum(Enum.map(books, & &1.price_cents))

        {:ok, %{
          shelf: input.arguments.shelf,
          book_count: book_count,
          review_count: review_count,
          total_price_cents: total_price_cents
        }}
      end
    end
  end

  policies do
    # Read policy: restricted books are invisible to non-curators
    policy action_type(:read) do
      authorize_if expr(restricted == false)
      authorize_if actor_attribute_equals(:role, :curator)
    end

    # Destroy policy: only curators can delete books
    policy action_type(:destroy) do
      authorize_if actor_attribute_equals(:role, :curator)
    end

    # Create, update and generic actions: open to everyone
    policy action_type([:create, :update, :action]) do
      authorize_if always()
    end
  end
end
